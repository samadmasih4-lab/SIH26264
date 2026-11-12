/**
 * AICTE OneView Backend Server (SIH26264)
 * High-performance, zero-external-dependency REST API server built with native Node.js.
 * Fully implements docs/DATA_MODEL.md, docs/PRODUCT.md, and docs/PROMPTS.md.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// -------------------------------------------------------------
// SEED DATA GENERATOR
// -------------------------------------------------------------
const INITIAL_CELLS = [
  { id: 1, name: 'Anti-Ragging Cell', sla_days: 7 },
  { id: 2, name: 'Approvals Bureau', sla_days: 15 },
  { id: 3, name: 'Finance & Refunds Cell', sla_days: 15 },
  { id: 4, name: 'Regional Office', sla_days: 15 },
  { id: 5, name: 'Legal Cell', sla_days: 15 }
];

const INITIAL_COLLEGES = [
  { id: 1, name: 'Sunrise Institute of Technology', state: 'Telangana', region: 'South' },
  { id: 2, name: 'Greenfield Engineering College', state: 'Karnataka', region: 'South' },
  { id: 3, name: 'Lakeview Polytechnic', state: 'Maharashtra', region: 'West' },
  { id: 4, name: 'Apex School of Management', state: 'Delhi', region: 'North' },
  { id: 5, name: 'Nova College of Pharmacy', state: 'Uttar Pradesh', region: 'North' },
  { id: 6, name: 'Heritage Institute of Engineering', state: 'West Bengal', region: 'East' },
  { id: 7, name: 'Riverbend Technical Campus', state: 'Gujarat', region: 'West' },
  { id: 8, name: 'Himalaya Institute of Technology', state: 'Uttarakhand', region: 'North' }
];

const DEMO_USERS = {
  'student@demo.test': {
    id: 'u-student-01',
    full_name: 'Aarav Sharma',
    email: 'student@demo.test',
    role: 'complainant',
    cell_id: null,
    language: 'en'
  },
  'officer@demo.test': {
    id: 'u-officer-01',
    full_name: 'Meera Iyer',
    email: 'officer@demo.test',
    role: 'officer',
    cell_id: 3, // Finance & Refunds
    language: 'en'
  },
  'ragging.officer@demo.test': {
    id: 'u-officer-02',
    full_name: 'Kavita Menon',
    email: 'ragging.officer@demo.test',
    role: 'officer',
    cell_id: 1, // Anti-Ragging
    language: 'en'
  },
  'approvals.officer@demo.test': {
    id: 'u-officer-03',
    full_name: 'Imran Qureshi',
    email: 'approvals.officer@demo.test',
    role: 'officer',
    cell_id: 2, // Approvals
    language: 'en'
  },
  'leadership@demo.test': {
    id: 'u-senior-01',
    full_name: 'R. K. Nair',
    email: 'leadership@demo.test',
    role: 'senior',
    cell_id: null,
    language: 'en'
  }
};

const SAMPLE_TEMPLATES = [
  {
    text: "College is refusing to refund my first-year fee of Rs 85,000 after I withdrew admission before the statutory cutoff date.",
    category: "Fee refund",
    cell_id: 3,
    urgency: "normal",
    lang: "en",
    summary: "Refusal to refund first-year tuition fee after timely admission withdrawal"
  },
  {
    text: "मैंने प्रवेश रद्द करने का आवेदन अंतिम तिथि से पहले जमा कर दिया था, लेकिन कॉलेज ने अभी तक मेरी 85,000 रुपये की फीस और धरोहर राशि वापस नहीं की है।",
    category: "Fee refund",
    cell_id: 3,
    urgency: "normal",
    lang: "hi",
    translated: "I submitted my admission cancellation application before the deadline, but the college has not yet refunded my fee of Rs 85,000 and security deposit.",
    summary: "अंतिम तिथि पूर्व प्रवेश रद्द करने पर 85,000 रुपये शुल्क वापसी विवाद"
  },
  {
    text: "The course I joined is not approved by AICTE but admissions are still going on under misleading advertisements.",
    category: "Approval & Affiliation",
    cell_id: 2,
    urgency: "normal",
    lang: "en",
    summary: "Conducting admissions in technical course without mandatory AICTE approval"
  },
  {
    text: "సంస్థలో కంప్యూటర్ ల్యాబ్ మరియు లైబ్రరీ వసతులు సరిగ్గా లేవు, ప్రాక్టికల్ పరీక్షలు నిర్వహించడానికి పరికరాలు లేవు.",
    category: "Infrastructure & Labs",
    cell_id: 4,
    urgency: "normal",
    lang: "te",
    translated: "In our institute, computer lab and library facilities are inadequate, lacking necessary equipment for practical examinations.",
    summary: "ప్రయోగశాల మరియు గ్రంథాలయ మౌలిక సదుపాయాల కొరత"
  },
  {
    text: "Senior students in the boys hostel have been subjecting first-year students to severe mental harassment and physical bullying at night.",
    category: "Ragging & Harassment",
    cell_id: 1,
    urgency: "high",
    lang: "en",
    summary: "Severe mental harassment and nighttime ragging in campus hostel"
  },
  {
    text: "College is withholding my original 10th and 12th certificates demanding additional unauthorized building fund charges.",
    category: "Withheld Certificates",
    cell_id: 5,
    urgency: "normal",
    lang: "en",
    summary: "Retention of original academic certificates against unauthorized demands"
  },
  {
    text: "Hostel wiring is completely unsafe with exposed cables near the bathroom, and the management has ignored repeated written alerts.",
    category: "Hostel Safety",
    cell_id: 4,
    urgency: "high",
    lang: "en",
    summary: "Dangerous electrical wiring hazards in student hostel quarters"
  },
  {
    text: "Tuition fee was deducted twice through the online portal, but accounts office refuses to reconcile and issue a receipt.",
    category: "Fee refund",
    cell_id: 3,
    urgency: "normal",
    lang: "en",
    summary: "Duplicate tuition transaction reconciliation and receipt dispute"
  }
];

function generateSeedDatabase() {
  const complaints = [];
  const case_updates = [];
  const notifications_log = [];

  let seq = 1001;
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < 70; i++) {
    const template = SAMPLE_TEMPLATES[i % SAMPLE_TEMPLATES.length];
    // Skew college 1 (Sunrise Institute) to demonstrate repeat-offender alerts
    const collegeId = (i % 3 === 0) ? 1 : ((i % 8) + 1);
    const cell = INITIAL_CELLS.find(c => c.id === template.cell_id) || INITIAL_CELLS[2];

    const daysAgo = (i * 0.35);
    const createdAt = new Date(nowMs - daysAgo * dayMs);
    const slaDays = cell.sla_days;
    const dueDate = new Date(createdAt.getTime() + slaDays * dayMs);

    let status = 'Submitted';
    let resolvedAt = null;

    if (i % 5 === 0) {
      status = 'Resolved';
      resolvedAt = new Date(createdAt.getTime() + (Math.min(slaDays - 1, 4)) * dayMs).toISOString();
    } else if (i % 4 === 0) {
      status = 'Notice Sent';
    } else if (i % 3 === 0) {
      status = 'Under Review';
    } else if (i === 13 || i === 27) {
      status = 'Escalated';
    }

    const complaintId = `c-${seq}`;
    const code = `AICTE-26-${String(seq).padStart(5, '0')}`;
    seq++;

    const isStudentDemo = (i === 0 || i === 1 || i === 2);
    const complainantId = isStudentDemo ? 'u-student-01' : `u-external-${i}`;

    const complaint = {
      id: complaintId,
      code,
      complainant_id: complainantId,
      college_id: collegeId,
      cell_id: cell.id,
      category: template.category,
      urgency: template.urgency,
      summary: template.summary,
      original_text: template.text,
      translated_text: template.translated || null,
      language: template.lang,
      status,
      routed_by: i % 2 === 0 ? 'ai' : 'rules',
      created_at: createdAt.toISOString(),
      due_date: dueDate.toISOString(),
      resolved_at: resolvedAt,
      attachments: [
        {
          id: `att-${i}-1`,
          complaint_id: complaintId,
          file_path: `uploads/${complaintId}/receipt.pdf`,
          file_name: 'fee_receipt_bank_statement.pdf',
          mime_type: 'application/pdf',
          size_bytes: 245000,
          created_at: createdAt.toISOString()
        }
      ]
    };

    complaints.push(complaint);

    // Initial audit entry
    case_updates.push({
      id: case_updates.length + 1,
      complaint_id: complaintId,
      actor_id: null,
      actor_role: 'system',
      action: 'Received',
      note: `Grievance registered. Routed by ${complaint.routed_by.toUpperCase()} to ${cell.name}. SLA: ${slaDays} days.`,
      old_status: null,
      new_status: 'Submitted',
      visible_to_complainant: true,
      created_at: createdAt.toISOString()
    });

    if (status === 'Under Review' || status === 'Notice Sent' || status === 'Resolved' || status === 'Escalated') {
      case_updates.push({
        id: case_updates.length + 1,
        complaint_id: complaintId,
        actor_id: 'u-officer-01',
        actor_role: 'officer',
        action: 'Case Accepted for Scrutiny',
        note: 'Grievance scrutinized by the designated Bureau Desk Officer.',
        old_status: 'Submitted',
        new_status: 'Under Review',
        visible_to_complainant: true,
        created_at: new Date(createdAt.getTime() + 1 * dayMs).toISOString()
      });
    }

    if (status === 'Notice Sent' || status === 'Resolved') {
      const noticeTime = new Date(createdAt.getTime() + 2 * dayMs).toISOString();
      const col = INITIAL_COLLEGES.find(c => c.id === collegeId);
      case_updates.push({
        id: case_updates.length + 1,
        complaint_id: complaintId,
        actor_id: 'u-officer-01',
        actor_role: 'officer',
        action: 'Notice Dispatched',
        note: `Statutory 7-day explanation notice dispatched to Registrar of ${col ? col.name : 'the College'}.`,
        old_status: 'Under Review',
        new_status: 'Notice Sent',
        visible_to_complainant: true,
        created_at: noticeTime
      });

      notifications_log.push({
        id: notifications_log.length + 1,
        complaint_id: complaintId,
        complaint_code: code,
        college_name: col ? col.name : 'Institution',
        channel: 'email',
        recipient: `registrar@${col ? col.name.toLowerCase().replace(/[^a-z]/g, '') : 'college'}.edu.in`,
        message: `Official Notice: Grievance ${code} regarding ${template.category}. Please furnish your institutional explanation within 7 calendar days.`,
        sent_at: noticeTime
      });
    }

    if (status === 'Resolved') {
      case_updates.push({
        id: case_updates.length + 1,
        complaint_id: complaintId,
        actor_id: 'u-officer-01',
        actor_role: 'officer',
        action: 'Case Resolved',
        note: 'Institution submitted written confirmation and bank transaction proof. Grievance closed with satisfaction.',
        old_status: 'Notice Sent',
        new_status: 'Resolved',
        visible_to_complainant: true,
        created_at: resolvedAt
      });
    }

    if (status === 'Escalated') {
      case_updates.push({
        id: case_updates.length + 1,
        complaint_id: complaintId,
        actor_id: null,
        actor_role: 'system',
        action: 'Escalated',
        note: "Statutory deadline exceeded without final closure. Escalated to Chairman's Office for direct intervention.",
        old_status: 'Under Review',
        new_status: 'Escalated',
        visible_to_complainant: true,
        created_at: dueDate.toISOString()
      });
    }
  }

  return {
    complaints,
    case_updates,
    notifications_log
  };
}

// -------------------------------------------------------------
// DATABASE STORE MANAGER
// -------------------------------------------------------------
class DatabaseStore {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to read db.json, generating fresh seed data:', e);
    }
    const seed = generateSeedDatabase();
    this.save(seed);
    return seed;
  }

  save(data = this.data) {
    try {
      this.data = data;
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to persist database:', e);
    }
  }

  reset() {
    const seed = generateSeedDatabase();
    this.save(seed);
    return seed;
  }
}

const store = new DatabaseStore();

// -------------------------------------------------------------
// AI ROUTING & KEYWORD ENGINE
// -------------------------------------------------------------
function detectLanguage(text) {
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return 'en';
}

function generateSummary(text) {
  const words = text.trim().split(/\s+/).slice(0, 12);
  let summary = words.join(' ');
  if (summary.length < text.length) summary += '...';
  return summary;
}

function routeComplaintKeywords(text) {
  const lower = text.toLowerCase();
  if (/ragg|bully|bullied|abus|torment|रैगिंग/i.test(lower)) {
    return { cell_id: 1, cell_name: 'Anti-Ragging Cell', category: 'Ragging & Harassment', urgency: 'high' };
  }
  if (/unapproved|not approved|approval|affiliat|recogni|मान्यता/i.test(lower)) {
    return { cell_id: 2, cell_name: 'Approvals Bureau', category: 'Approval & Affiliation', urgency: 'normal' };
  }
  if (/fee|refund|deposit|scholarship|fine|फीस|वापसी|रिफंड/i.test(lower)) {
    return { cell_id: 3, cell_name: 'Finance & Refunds Cell', category: 'Fee refund', urgency: 'normal' };
  }
  if (/hostel|lab|faculty|infrastructure|classroom|library/i.test(lower)) {
    return { cell_id: 4, cell_name: 'Regional Office', category: 'Infrastructure & Labs', urgency: 'normal' };
  }
  return { cell_id: 5, cell_name: 'Legal Cell', category: 'Legal Disputes', urgency: 'normal' };
}

async function callGeminiAi(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const promptPayload = {
      contents: [{
        role: "user",
        parts: [{ text: `Analyze this technical education grievance in India:\n"""\n${text}\n"""` }]
      }],
      systemInstruction: {
        parts: [{
          text: `You are the AI routing engine for AICTE (All India Council for Technical Education).
Classify the grievance into exactly one bureau:
- Anti-Ragging Cell (ragging, abuse, student safety)
- Approvals Bureau (unapproved courses, affiliation fraud, bogus degrees)
- Finance & Refunds Cell (tuition fee refund, caution money retention, fine extortion)
- Regional Office (hostel conditions, lab equipment, faculty shortage)
- Legal Cell (court cases, legal appeals)

Return valid JSON ONLY:
{
  "cell": "Anti-Ragging Cell"|"Approvals Bureau"|"Finance & Refunds Cell"|"Regional Office"|"Legal Cell",
  "category": "short category name",
  "urgency": "low"|"normal"|"high",
  "summary": "1-line English summary",
  "language": "en"|"hi"|"te",
  "english_text": "accurate English translation"
}`
        }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promptPayload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidate) return JSON.parse(candidate);
    }
  } catch (e) {
    // Fall back to keyword rules
  }
  return null;
}

// -------------------------------------------------------------
// HTTP UTILS
// -------------------------------------------------------------
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-demo-role'
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function getAuthUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token && DEMO_USERS[token]) {
    return DEMO_USERS[token];
  }
  const demoRole = req.headers['x-demo-role'];
  if (demoRole === 'senior') return DEMO_USERS['leadership@demo.test'];
  if (demoRole === 'officer') return DEMO_USERS['officer@demo.test'];
  if (demoRole === 'complainant') return DEMO_USERS['student@demo.test'];
  // Default to student demo user if unspecified
  return DEMO_USERS['student@demo.test'];
}

// -------------------------------------------------------------
// REQUEST ROUTER
// -------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-demo-role'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // 1. HEALTH CHECK
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'AICTE OneView Backend (SIH26264)',
        uptime: process.uptime(),
        counts: {
          complaints: store.data.complaints.length,
          case_updates: store.data.case_updates.length,
          notifications: store.data.notifications_log.length
        },
        gemini_configured: Boolean(process.env.GEMINI_API_KEY),
        timestamp: new Date().toISOString()
      });
    }

    // 2. CELLS & COLLEGES
    if (pathname === '/api/cells' && method === 'GET') {
      return sendJson(res, 200, INITIAL_CELLS);
    }

    if (pathname === '/api/colleges' && method === 'GET') {
      return sendJson(res, 200, INITIAL_COLLEGES);
    }

    // 3. AUTH ENDPOINTS
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const email = (body.email || '').toLowerCase().trim();
      const user = DEMO_USERS[email] || {
        id: `u-${Date.now()}`,
        full_name: email.split('@')[0],
        email,
        role: 'complainant',
        cell_id: null,
        language: 'en'
      };
      return sendJson(res, 200, { user, token: email });
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      const user = getAuthUser(req);
      return sendJson(res, 200, { user, token: user.email });
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      return sendJson(res, 200, { success: true });
    }

    // 4. CREATE COMPLAINT
    if (pathname === '/api/complaints' && method === 'POST') {
      const body = await parseJsonBody(req);
      const user = getAuthUser(req);

      const text = body.original_text || '';
      if (!text || text.trim().length < 20) {
        return sendJson(res, 400, { error: 'Please enter at least 20 characters describing your grievance.' });
      }

      const collegeId = parseInt(body.college_id, 10);
      const college = INITIAL_COLLEGES.find(c => c.id === collegeId) || INITIAL_COLLEGES[0];

      // Routing logic: Attempt Gemini AI first, fallback to keywords
      let routedBy = 'rules';
      let cellId = 5;
      let category = 'Legal Disputes';
      let urgency = 'normal';
      let summary = generateSummary(text);
      let language = detectLanguage(text);
      let translatedText = null;

      const aiResult = await callGeminiAi(text);
      if (aiResult && aiResult.cell) {
        routedBy = 'ai';
        const targetCell = INITIAL_CELLS.find(c => c.name.toLowerCase() === aiResult.cell.toLowerCase());
        if (targetCell) cellId = targetCell.id;
        category = aiResult.category || category;
        urgency = aiResult.urgency || urgency;
        summary = aiResult.summary || summary;
        language = aiResult.language || language;
        translatedText = aiResult.english_text || null;
      } else {
        const kw = routeComplaintKeywords(text);
        cellId = kw.cell_id;
        category = kw.category;
        urgency = kw.urgency;
      }

      const cell = INITIAL_CELLS.find(c => c.id === cellId) || INITIAL_CELLS[2];
      const slaDays = cell.sla_days;
      const now = new Date();
      const dueDate = new Date(now.getTime() + slaDays * 24 * 60 * 60 * 1000);

      const seq = 1001 + store.data.complaints.length;
      const complaintId = `c-${Date.now()}`;
      const code = `AICTE-26-${String(seq).padStart(5, '0')}`;

      const newComplaint = {
        id: complaintId,
        code,
        complainant_id: user.id,
        college_id: college.id,
        cell_id: cell.id,
        category,
        urgency,
        summary,
        original_text: text,
        translated_text: translatedText,
        language,
        status: 'Submitted',
        routed_by: routedBy,
        created_at: now.toISOString(),
        due_date: dueDate.toISOString(),
        resolved_at: null,
        attachments: (body.files || []).map((f, idx) => ({
          id: `att-${Date.now()}-${idx}`,
          complaint_id: complaintId,
          file_path: `uploads/${complaintId}/${f.name}`,
          file_name: f.name,
          mime_type: f.type || 'application/pdf',
          size_bytes: f.size || 102400,
          created_at: now.toISOString()
        }))
      };

      store.data.complaints.unshift(newComplaint);

      // Audit trail entry
      store.data.case_updates.push({
        id: store.data.case_updates.length + 1,
        complaint_id: complaintId,
        actor_id: user.id,
        actor_role: 'system',
        action: 'Received',
        note: `Grievance registered and routed by ${routedBy.toUpperCase()} to ${cell.name}. Statutory SLA: ${slaDays} days.`,
        old_status: null,
        new_status: 'Submitted',
        visible_to_complainant: true,
        created_at: now.toISOString()
      });

      store.save();
      return sendJson(res, 201, newComplaint);
    }

    // 5. LIST MY COMPLAINTS
    if (pathname === '/api/complaints/my' && method === 'GET') {
      const user = getAuthUser(req);
      const myComplaints = store.data.complaints.filter(c => c.complainant_id === user.id);
      return sendJson(res, 200, myComplaints);
    }

    // 6. PUBLIC TRACK BY CODE
    const trackMatch = pathname.match(/^\/api\/track\/([A-Za-z0-9\-]+)$/);
    if (trackMatch && method === 'GET') {
      const code = decodeURIComponent(trackMatch[1]).toUpperCase().trim();
      const complaint = store.data.complaints.find(c => c.code.toUpperCase() === code);
      if (!complaint) {
        return sendJson(res, 404, { error: 'Grievance record not found.' });
      }

      const college = INITIAL_COLLEGES.find(c => c.id === complaint.college_id);
      const cell = INITIAL_CELLS.find(c => c.id === complaint.cell_id);
      const updates = store.data.case_updates
        .filter(u => u.complaint_id === complaint.id && u.visible_to_complainant)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(u => ({ action: u.action, at: u.created_at }));

      return sendJson(res, 200, {
        code: complaint.code,
        status: complaint.status,
        cell: cell ? cell.name : 'AICTE Bureau',
        college: college ? college.name : 'Technical Institution',
        created_at: complaint.created_at,
        due_date: complaint.due_date,
        timeline: updates
      });
    }

    // 7. COMPLAINT DETAIL BY CODE
    const detailMatch = pathname.match(/^\/api\/complaints\/([A-Za-z0-9\-]+)$/);
    if (detailMatch && method === 'GET') {
      const code = decodeURIComponent(detailMatch[1]).toUpperCase().trim();
      const complaint = store.data.complaints.find(c => c.code.toUpperCase() === code);
      if (!complaint) {
        return sendJson(res, 404, { error: 'Complaint not found' });
      }

      const college = INITIAL_COLLEGES.find(c => c.id === complaint.college_id) || INITIAL_COLLEGES[0];
      const cell = INITIAL_CELLS.find(c => c.id === complaint.cell_id) || INITIAL_CELLS[0];
      const updates = store.data.case_updates
        .filter(u => u.complaint_id === complaint.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return sendJson(res, 200, {
        ...complaint,
        college,
        cell,
        updates,
        attachments: complaint.attachments || []
      });
    }

    // 8. OFFICER INBOX (CASES LIST)
    if (pathname === '/api/cases' && method === 'GET') {
      const cellIdParam = parsedUrl.searchParams.get('cell_id');
      const statusParam = parsedUrl.searchParams.get('status');
      const collegeIdParam = parsedUrl.searchParams.get('college_id');
      const overdueOnlyParam = parsedUrl.searchParams.get('overdueOnly') === 'true';

      let results = store.data.complaints.map(c => {
        const college = INITIAL_COLLEGES.find(col => col.id === c.college_id);
        const cell = INITIAL_CELLS.find(cel => cel.id === c.cell_id);
        return {
          id: c.id,
          code: c.code,
          college_id: c.college_id,
          college_name: college ? college.name : 'Unknown College',
          college_state: college ? college.state : '',
          cell_id: c.cell_id,
          cell_name: cell ? cell.name : 'Unknown Cell',
          category: c.category || 'General',
          urgency: c.urgency,
          summary: c.summary,
          status: c.status,
          created_at: c.created_at,
          due_date: c.due_date,
          original_text: c.original_text,
          translated_text: c.translated_text,
          language: c.language
        };
      });

      if (cellIdParam) {
        const cid = parseInt(cellIdParam, 10);
        results = results.filter(r => r.cell_id === cid);
      }
      if (statusParam && statusParam !== 'All') {
        results = results.filter(r => r.status.toLowerCase() === statusParam.toLowerCase());
      }
      if (collegeIdParam) {
        const colId = parseInt(collegeIdParam, 10);
        results = results.filter(r => r.college_id === colId);
      }
      if (overdueOnlyParam) {
        const now = Date.now();
        results = results.filter(r => r.status !== 'Resolved' && new Date(r.due_date).getTime() < now);
      }

      // Sort by due date ascending
      results.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      return sendJson(res, 200, results);
    }

    // 9. UPDATE CASE (DESK SCRUTINY, NOTICE DISPATCH, RESOLUTION)
    const caseUpdateMatch = pathname.match(/^\/api\/cases\/([A-Za-z0-9\-]+)$/);
    if (caseUpdateMatch && method === 'PATCH') {
      const caseId = caseUpdateMatch[1];
      const body = await parseJsonBody(req);
      const user = getAuthUser(req);

      const complaint = store.data.complaints.find(c => c.id === caseId || c.code === caseId);
      if (!complaint) {
        return sendJson(res, 404, { error: 'Case not found' });
      }

      const now = new Date().toISOString();
      const oldStatus = complaint.status;
      let newStatus = oldStatus;

      if (body.notice) {
        newStatus = 'Notice Sent';
        complaint.status = 'Notice Sent';

        const college = INITIAL_COLLEGES.find(c => c.id === complaint.college_id);
        store.data.case_updates.push({
          id: store.data.case_updates.length + 1,
          complaint_id: complaint.id,
          actor_id: user.id,
          actor_role: 'officer',
          action: 'Notice Sent',
          note: body.note || 'Statutory 7-day explanation notice dispatched to institution.',
          old_status: oldStatus,
          new_status: 'Notice Sent',
          visible_to_complainant: true,
          created_at: now
        });

        store.data.notifications_log.unshift({
          id: store.data.notifications_log.length + 1,
          complaint_id: complaint.id,
          complaint_code: complaint.code,
          college_name: college ? college.name : 'College',
          channel: 'email',
          recipient: `registrar@${college ? college.name.toLowerCase().replace(/[^a-z]/g, '') : 'college'}.edu.in`,
          message: body.note || 'Formal notice dispatched by Bureau Desk Officer.',
          sent_at: now
        });
      } else {
        if (body.status) {
          newStatus = body.status;
          complaint.status = body.status;
          if (newStatus === 'Resolved') {
            complaint.resolved_at = now;
          }
        }

        store.data.case_updates.push({
          id: store.data.case_updates.length + 1,
          complaint_id: complaint.id,
          actor_id: user.id,
          actor_role: 'officer',
          action: newStatus !== oldStatus ? 'Status Changed' : 'Note Added',
          note: body.note || `Case status updated to ${newStatus}`,
          old_status: oldStatus,
          new_status: newStatus,
          visible_to_complainant: true,
          created_at: now
        });
      }

      store.save();
      return sendJson(res, 200, { success: true, complaint });
    }

    // 10. SIMILAR CASES
    const similarMatch = pathname.match(/^\/api\/cases\/([A-Za-z0-9\-]+)\/similar$/);
    if (similarMatch && method === 'GET') {
      const caseId = similarMatch[1];
      const target = store.data.complaints.find(c => c.id === caseId || c.code === caseId);
      if (!target) return sendJson(res, 200, []);

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const targetTime = new Date(target.created_at).getTime();

      const similar = store.data.complaints
        .filter(c => c.id !== target.id &&
                     c.college_id === target.college_id &&
                     c.category === target.category &&
                     Math.abs(new Date(c.created_at).getTime() - targetTime) <= thirtyDaysMs)
        .map(c => {
          const col = INITIAL_COLLEGES.find(col => col.id === c.college_id);
          const cel = INITIAL_CELLS.find(cel => cel.id === c.cell_id);
          return {
            id: c.id,
            code: c.code,
            college_id: c.college_id,
            college_name: col ? col.name : '',
            college_state: col ? col.state : '',
            cell_id: c.cell_id,
            cell_name: cel ? cel.name : '',
            category: c.category,
            urgency: c.urgency,
            summary: c.summary,
            status: c.status,
            created_at: c.created_at,
            due_date: c.due_date,
            original_text: c.original_text,
            language: c.language
          };
        });

      return sendJson(res, 200, similar);
    }

    // 11. NOTIFICATIONS LOG
    if (pathname === '/api/notifications' && method === 'GET') {
      return sendJson(res, 200, store.data.notifications_log);
    }

    // 12. LEADERSHIP ANALYTICS: KPIS
    if (pathname === '/api/analytics/kpis' && method === 'GET') {
      const complaints = store.data.complaints;
      const total = complaints.length;
      const open_cases = complaints.filter(c => c.status !== 'Resolved').length;
      const resolved = complaints.filter(c => c.status === 'Resolved').length;
      const escalated = complaints.filter(c => c.status === 'Escalated').length;

      const now = Date.now();
      const breached = complaints.filter(c => {
        if (c.status === 'Escalated') return true;
        if (c.status !== 'Resolved' && new Date(c.due_date).getTime() < now) return true;
        if (c.status === 'Resolved' && c.resolved_at && new Date(c.resolved_at).getTime() > new Date(c.due_date).getTime()) return true;
        return false;
      }).length;

      const sla_breach_pct = total > 0 ? parseFloat(((breached / total) * 100).toFixed(1)) : 0;

      const resolvedTimes = complaints
        .filter(c => c.status === 'Resolved' && c.resolved_at)
        .map(c => (new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()) / (24 * 60 * 60 * 1000));

      const avg_resolution_days = resolvedTimes.length > 0
        ? parseFloat((resolvedTimes.reduce((acc, v) => acc + v, 0) / resolvedTimes.length).toFixed(1))
        : 6.4;

      return sendJson(res, 200, {
        total,
        open_cases,
        resolved,
        escalated,
        sla_breach_pct,
        avg_resolution_days
      });
    }

    // 13. LEADERSHIP ANALYTICS: BY COLLEGE
    if (pathname === '/api/analytics/by-college' && method === 'GET') {
      const stats = INITIAL_COLLEGES.map(col => {
        const colComplaints = store.data.complaints.filter(c => c.college_id === col.id);
        return {
          college: col.name,
          state: col.state,
          total: colComplaints.length,
          open_cases: colComplaints.filter(c => c.status !== 'Resolved').length,
          escalated: colComplaints.filter(c => c.status === 'Escalated').length
        };
      }).sort((a, b) => b.total - a.total);
      return sendJson(res, 200, stats);
    }

    // 14. LEADERSHIP ANALYTICS: BY CELL
    if (pathname === '/api/analytics/by-cell' && method === 'GET') {
      const stats = INITIAL_CELLS.map(cell => {
        const cellComplaints = store.data.complaints.filter(c => c.cell_id === cell.id);
        const resolved = cellComplaints.filter(c => c.status === 'Resolved' && c.resolved_at);
        const avg = resolved.length > 0
          ? parseFloat((resolved.reduce((acc, c) => acc + (new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()) / (24 * 60 * 60 * 1000), 0) / resolved.length).toFixed(1))
          : cell.sla_days - 2;

        return {
          cell: cell.name,
          total: cellComplaints.length,
          open_cases: cellComplaints.filter(c => c.status !== 'Resolved').length,
          escalated: cellComplaints.filter(c => c.status === 'Escalated').length,
          avg_resolution_days: avg
        };
      });
      return sendJson(res, 200, stats);
    }

    // 15. LEADERSHIP ANALYTICS: BY CATEGORY
    if (pathname === '/api/analytics/by-category' && method === 'GET') {
      const counts = {};
      for (const c of store.data.complaints) {
        const cat = c.category || 'General';
        counts[cat] = (counts[cat] || 0) + 1;
      }
      const stats = Object.entries(counts)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
      return sendJson(res, 200, stats);
    }

    // 16. LEADERSHIP ANALYTICS: TREND
    if (pathname === '/api/analytics/trend' && method === 'GET') {
      const weeks = {};
      for (const c of store.data.complaints) {
        const d = new Date(c.created_at);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(d.setDate(diff)).toISOString().split('T')[0];
        weeks[mon] = (weeks[mon] || 0) + 1;
      }
      const trend = Object.entries(weeks)
        .map(([week, total]) => ({ week, total }))
        .sort((a, b) => a.week.localeCompare(b.week));
      return sendJson(res, 200, trend);
    }

    // 17. REPEAT OFFENDERS (3+ in 30 days)
    if (pathname === '/api/analytics/repeat-offenders' && method === 'GET') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const grouping = {};

      for (const c of store.data.complaints) {
        if (new Date(c.created_at).getTime() >= thirtyDaysAgo) {
          const col = INITIAL_COLLEGES.find(cl => cl.id === c.college_id);
          const colName = col ? col.name : 'Unknown';
          const key = `${colName}:::${c.category}`;
          grouping[key] = (grouping[key] || 0) + 1;
        }
      }

      const repeat = [];
      for (const [key, count] of Object.entries(grouping)) {
        if (count >= 3) {
          const [college, category] = key.split(':::');
          repeat.push({ college, category, cases_30d: count });
        }
      }
      repeat.sort((a, b) => b.cases_30d - a.cases_30d);
      return sendJson(res, 200, repeat);
    }

    // 18. SLA ESCALATION CHECK
    if (pathname === '/api/escalate-overdue' && method === 'POST') {
      const now = Date.now();
      let escalatedCount = 0;

      for (const c of store.data.complaints) {
        if (c.status !== 'Resolved' && c.status !== 'Escalated') {
          if (new Date(c.due_date).getTime() < now) {
            c.status = 'Escalated';
            escalatedCount++;
            store.data.case_updates.push({
              id: store.data.case_updates.length + 1,
              complaint_id: c.id,
              actor_id: null,
              actor_role: 'system',
              action: 'Escalated',
              note: "Statutory deadline exceeded without final closure. Escalated to Chairman's Office for direct intervention.",
              old_status: 'Under Review',
              new_status: 'Escalated',
              visible_to_complainant: true,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      store.save();
      return sendJson(res, 200, { escalated: escalatedCount });
    }

    // 19. SIMULATE DAYS (SENIOR DEMO CONTROL)
    if (pathname === '/api/simulate-days' && method === 'POST') {
      const body = await parseJsonBody(req);
      const days = parseInt(body.days, 10) || 16;
      const shiftMs = days * 24 * 60 * 60 * 1000;
      const now = Date.now();
      let newlyEscalated = 0;

      for (const c of store.data.complaints) {
        if (c.status !== 'Resolved') {
          const oldDue = new Date(c.due_date).getTime();
          const newDue = new Date(oldDue - shiftMs);
          c.due_date = newDue.toISOString();

          if (c.status !== 'Escalated' && newDue.getTime() < now) {
            c.status = 'Escalated';
            newlyEscalated++;
            store.data.case_updates.push({
              id: store.data.case_updates.length + 1,
              complaint_id: c.id,
              actor_id: null,
              actor_role: 'system',
              action: 'Escalated',
              note: `Simulated deadline elapsed (${days} days advanced). Auto-escalated to Chairman's Office.`,
              old_status: 'Under Review',
              new_status: 'Escalated',
              visible_to_complainant: true,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      store.save();
      return sendJson(res, 200, { escalated: newlyEscalated, daysSimulated: days });
    }

    // 20. RESET DEMO DATA
    if (pathname === '/api/reset-demo' && method === 'POST') {
      store.reset();
      return sendJson(res, 200, { success: true, message: 'Demo data restored to initial seed state.' });
    }

    // 21. AI ROUTE TEST ENDPOINT
    if (pathname === '/api/ai/route' && method === 'POST') {
      const body = await parseJsonBody(req);
      const text = body.text || '';
      const aiResult = await callGeminiAi(text);
      if (aiResult) {
        return sendJson(res, 200, { routed_by: 'ai', ...aiResult });
      }
      const kw = routeComplaintKeywords(text);
      return sendJson(res, 200, {
        routed_by: 'rules',
        cell: kw.cell_name,
        category: kw.category,
        urgency: kw.urgency,
        summary: generateSummary(text),
        language: detectLanguage(text)
      });
    }

    // Not Found
    return sendJson(res, 404, { error: `Endpoint not found: ${method} ${pathname}` });
  } catch (err) {
    console.error('Server error:', err);
    return sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`[AICTE OneView Backend] Running on http://localhost:${PORT}`);
  console.log(`[AICTE OneView Backend] Endpoints ready: /api/health, /api/complaints, /api/cases, /api/analytics/...`);
});
