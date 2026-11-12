// Supabase Edge Function: route-complaint
// Autonomous AI routing and translation using Gemini API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const ALLOWED_CELLS = [
  "Anti-Ragging Cell",
  "Approvals Bureau",
  "Finance & Refunds Cell",
  "Regional Office",
  "Legal Cell"
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { complaint_id } = await req.json();
    if (!complaint_id) {
      return new Response(JSON.stringify({ error: "complaint_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch complaint
    const { data: complaint, error: fetchErr } = await supabase
      .from("complaints")
      .select("id, original_text, created_at, cell_id")
      .eq("id", complaint_id)
      .single();

    if (fetchErr || !complaint) {
      return new Response(JSON.stringify({ error: "Complaint not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

    if (!geminiKey) {
      // Fallback: rule-based
      return new Response(JSON.stringify({ routed_by: "rules", reason: "GEMINI_API_KEY not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Call Gemini API with 5s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const systemInstruction = `You are the AI routing and translation engine for the All India Council for Technical Education (AICTE).
Analyze the user grievance text and classify it into exactly one of these AICTE bureaus/cells:
- "Anti-Ragging Cell" (for ragging, physical/mental harassment, bullying, safety threats)
- "Approvals Bureau" (for unapproved colleges/courses, lack of affiliation, fake recognition, accreditation fraud)
- "Finance & Refunds Cell" (for tuition fee refund disputes, caution deposit retention, scholarship withholding, extra fee extortion)
- "Regional Office" (for hostel conditions, broken lab equipment, missing faculty, physical infrastructure)
- "Legal Cell" (for other legal disputes, court notices, RTI appeals, procedural irregularities)

Respond ONLY with valid JSON with this exact schema:
{
  "cell": "Anti-Ragging Cell" | "Approvals Bureau" | "Finance & Refunds Cell" | "Regional Office" | "Legal Cell",
  "category": "short string describing category (e.g. Fee refund, Ragging & Harassment)",
  "urgency": "low" | "normal" | "high",
  "summary": "concise one-line summary in English (max 15 words)",
  "language": "ISO language code: en, hi, or te",
  "english_text": "full professional English translation of the complaint text, or identical text if already English"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;

    const promptPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `Complaint text to analyze:\n"""\n${complaint.original_text}\n"""` }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    let aiResult: any = null;
    try {
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptPayload),
        signal: controller.signal
      });

      if (response.ok) {
        const json = await response.json();
        const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          aiResult = JSON.parse(candidateText);
        }
      }
    } catch {
      // Timeout or API error -> fallback to rules
    } finally {
      clearTimeout(timeoutId);
    }

    if (!aiResult || !ALLOWED_CELLS.includes(aiResult.cell)) {
      return new Response(JSON.stringify({ routed_by: "rules" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Resolve cell id
    const { data: cellRecord } = await supabase
      .from("cells")
      .select("id, name, sla_days")
      .eq("name", aiResult.cell)
      .single();

    if (!cellRecord) {
      return new Response(JSON.stringify({ routed_by: "rules" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const slaDays = cellRecord.sla_days || 15;
    const createdAt = new Date(complaint.created_at);
    const dueDate = new Date(createdAt.getTime() + slaDays * 24 * 60 * 60 * 1000).toISOString();

    // 4. Update complaint
    await supabase
      .from("complaints")
      .update({
        cell_id: cellRecord.id,
        category: aiResult.category || cellRecord.name,
        urgency: ["low", "normal", "high"].includes(aiResult.urgency) ? aiResult.urgency : "normal",
        summary: aiResult.summary || "Grievance under review",
        language: aiResult.language || "en",
        translated_text: aiResult.english_text || complaint.original_text,
        routed_by: "ai",
        due_date: dueDate
      })
      .eq("id", complaint.id);

    // 5. Audit update
    await supabase.from("case_updates").insert({
      complaint_id: complaint.id,
      actor_role: "system",
      action: "Routed by AI",
      note: `Classified by Gemini AI into ${cellRecord.name}. Statutory SLA deadline set to ${slaDays} days.`,
      new_status: "Submitted"
    });

    return new Response(
      JSON.stringify({
        routed_by: "ai",
        cell: cellRecord.name,
        category: aiResult.category,
        summary: aiResult.summary,
        language: aiResult.language,
        due_date: dueDate
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, routed_by: "rules" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

