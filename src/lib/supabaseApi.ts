import {
  Cell,
  College,
  Complaint,
  ComplaintDetail,
  CaseRow,
  NotificationRow,
  PublicTrack,
  Session,
  Status,
  Kpis,
  CollegeStats,
  CellStats,
  CategoryStats,
  TrendStats,
  RepeatOffender
} from './types';
import { Api } from './api';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { getStoredSession, setStoredSession, DEMO_USERS } from './session';

function getHeaders(token?: string) {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  const activeToken = token || getStoredSession()?.token;
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }
  return headers;
}

async function supaFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers as Record<string, string> || {})
    }
  });

  if (!res.ok) {
    let errMessage = `Supabase request failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.message) errMessage = errJson.message;
      else if (errJson.error_description) errMessage = errJson.error_description;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  return res.json() as Promise<T>;
}

export const supabaseApi: Api = {
  async signIn(email: string): Promise<Session> {
    const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || 'Demo@2026';

    try {
      const authRes = await supaFetch<{ access_token: string; user: { id: string; email: string } }>(
        '/auth/v1/token?grant_type=password',
        {
          method: 'POST',
          body: JSON.stringify({ email, password: demoPassword })
        }
      );

      // Fetch profile
      const profiles = await supaFetch<any[]>(
        `/rest/v1/profiles?id=eq.${authRes.user.id}&select=*`,
        {
          headers: { Authorization: `Bearer ${authRes.access_token}` }
        }
      );

      const profile = profiles[0] || {};
      const user = {
        id: authRes.user.id,
        full_name: profile.full_name || email.split('@')[0],
        email: authRes.user.email,
        role: profile.role || 'complainant',
        cell_id: profile.cell_id || null,
        language: profile.language || 'en'
      };

      const session: Session = { user, token: authRes.access_token };
      setStoredSession(session);
      return session;
    } catch (err) {
      // If direct auth fails in demo mode, fallback to demo user matching email
      const fallbackUser = DEMO_USERS[email.toLowerCase().trim()];
      if (fallbackUser) {
        const session: Session = { user: fallbackUser, token: 'demo-supabase-jwt' };
        setStoredSession(session);
        return session;
      }
      throw err;
    }
  },

  async signOut(): Promise<void> {
    setStoredSession(null);
  },

  getSession(): Session | null {
    return getStoredSession();
  },

  async listColleges(): Promise<College[]> {
    return supaFetch<College[]>('/rest/v1/colleges?select=*&order=id.asc');
  },

  async listCells(): Promise<Cell[]> {
    return supaFetch<Cell[]>('/rest/v1/cells?select=*&order=id.asc');
  },

  async createComplaint(input: {
    college_id: number;
    original_text: string;
    files: { name: string; size: number; type: string }[];
  }): Promise<Complaint> {
    const session = getStoredSession();
    if (!session) throw new Error('Please sign in to file a grievance.');

    const insertPayload = {
      college_id: input.college_id,
      original_text: input.original_text,
      complainant_id: session.user.id
    };

    const inserted = await supaFetch<Complaint[]>('/rest/v1/complaints', {
      method: 'POST',
      body: JSON.stringify(insertPayload)
    });

    const complaint = inserted[0];

    // Trigger Edge Function for Gemini routing & translation if deployed
    try {
      fetch(`${SUPABASE_URL}/functions/v1/route-complaint`, {
        method: 'POST',
        headers: getHeaders(session.token),
        body: JSON.stringify({ complaint_id: complaint.id })
      }).catch(() => {
        // asynchronous, ignore edge function errors
      });
    } catch {
      // ignore
    }

    return complaint;
  },

  async listMyComplaints(): Promise<Complaint[]> {
    const session = getStoredSession();
    if (!session) return [];
    return supaFetch<Complaint[]>(
      `/rest/v1/complaints?complainant_id=eq.${session.user.id}&select=*&order=created_at.desc`
    );
  },

  async getComplaintByCode(code: string): Promise<ComplaintDetail> {
    const res = await supaFetch<any[]>(
      `/rest/v1/complaints?code=ilike.${encodeURIComponent(code)}&select=*,colleges(*),cells(*),case_updates(*),attachments(*)`
    );
    if (!res || res.length === 0) throw new Error('Complaint not found');
    const c = res[0];
    return {
      ...c,
      college: c.colleges,
      cell: c.cells,
      updates: (c.case_updates || []).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      attachments: c.attachments || []
    };
  },

  async trackByCode(code: string): Promise<PublicTrack | null> {
    try {
      const res = await supaFetch<PublicTrack>('/rest/v1/rpc/track_complaint', {
        method: 'POST',
        body: JSON.stringify({ p_code: code })
      });
      return res;
    } catch {
      return null;
    }
  },

  async listCases(filter: {
    cell_id?: number;
    status?: string;
    college_id?: number;
    overdueOnly?: boolean;
  }): Promise<CaseRow[]> {
    let query = '/rest/v1/complaints?select=id,code,complainant_id,college_id,cell_id,category,urgency,summary,status,routed_by,created_at,due_date,resolved_at,original_text,translated_text,language,attachments(*),colleges(name,state),cells(name)&order=due_date.asc';

    if (filter.cell_id) query += `&cell_id=eq.${filter.cell_id}`;
    if (filter.status && filter.status !== 'All') query += `&status=eq.${filter.status}`;
    if (filter.college_id) query += `&college_id=eq.${filter.college_id}`;
    if (filter.overdueOnly) query += `&status=neq.Resolved&due_date=lt.now()`;

    const raw = await supaFetch<any[]>(query);
    return raw.map(r => ({
      id: r.id,
      code: r.code,
      complainant_id: r.complainant_id || '',
      college_id: r.college_id,
      college_name: r.colleges?.name || 'Unknown',
      college_state: r.colleges?.state || '',
      college_aicte_id: `1-${(10000000 + (r.college_id || 1) * 987654)}`,
      cell_id: r.cell_id,
      cell_name: r.cells?.name || 'Unknown',
      category: r.category || 'General',
      urgency: r.urgency || 'normal',
      summary: r.summary || '',
      status: r.status,
      routed_by: r.routed_by || 'rules',
      created_at: r.created_at,
      due_date: r.due_date,
      resolved_at: r.resolved_at || null,
      original_text: r.original_text,
      translated_text: r.translated_text,
      language: r.language || 'en',
      attachments: r.attachments || [],
      overlap_alert: false,
      overlap_case_ids: [],
      overlap_reasons: []
    }));
  },

  async updateCase(
    id: string,
    patch: { status?: Status; note?: string; notice?: boolean }
  ): Promise<void> {
    await supaFetch('/rest/v1/rpc/officer_update_case', {
      method: 'POST',
      body: JSON.stringify({
        p_complaint: id,
        p_status: patch.status || null,
        p_note: patch.note || null,
        p_notice: Boolean(patch.notice)
      })
    });
  },

  async similarCases(id: string): Promise<CaseRow[]> {
    // Find complaint details first
    const cases = await supaFetch<any[]>(`/rest/v1/complaints?id=eq.${id}&select=college_id,category,created_at`);
    if (!cases || cases.length === 0) return [];
    const target = cases[0];

    const raw = await supaFetch<any[]>(
      `/rest/v1/complaints?college_id=eq.${target.college_id}&category=eq.${target.category}&id=neq.${id}&select=id,code,complainant_id,college_id,cell_id,category,urgency,summary,status,routed_by,created_at,due_date,resolved_at,original_text,translated_text,language,attachments(*),colleges(name,state),cells(name)&order=created_at.desc&limit=10`
    );

    return raw.map(r => ({
      id: r.id,
      code: r.code,
      complainant_id: r.complainant_id || '',
      college_id: r.college_id,
      college_name: r.colleges?.name || '',
      college_state: r.colleges?.state || '',
      college_aicte_id: `1-${(10000000 + (r.college_id || 1) * 987654)}`,
      cell_id: r.cell_id,
      cell_name: r.cells?.name || '',
      category: r.category,
      urgency: r.urgency || 'normal',
      summary: r.summary || '',
      status: r.status,
      routed_by: r.routed_by || 'rules',
      created_at: r.created_at,
      due_date: r.due_date,
      resolved_at: r.resolved_at || null,
      original_text: r.original_text,
      translated_text: r.translated_text,
      language: r.language || 'en',
      attachments: r.attachments || [],
      overlap_alert: false,
      overlap_case_ids: [],
      overlap_reasons: []
    }));
  },

  async listNotifications(): Promise<NotificationRow[]> {
    return supaFetch<NotificationRow[]>('/rest/v1/notifications_log?select=*&order=sent_at.desc&limit=50');
  },

  async getKpis(): Promise<Kpis> {
    const rows = await supaFetch<Kpis[]>('/rest/v1/v_kpis');
    return rows[0] || {
      total: 0,
      open_cases: 0,
      resolved: 0,
      escalated: 0,
      sla_breach_pct: 0,
      avg_resolution_days: 0
    };
  },

  async getByCollege(): Promise<CollegeStats[]> {
    return supaFetch<CollegeStats[]>('/rest/v1/v_by_college?order=total.desc');
  },

  async getByCell(): Promise<CellStats[]> {
    return supaFetch<CellStats[]>('/rest/v1/v_by_cell?order=total.desc');
  },

  async getByCategory(): Promise<CategoryStats[]> {
    return supaFetch<CategoryStats[]>('/rest/v1/v_by_category?order=total.desc');
  },

  async getTrend(): Promise<TrendStats[]> {
    return supaFetch<TrendStats[]>('/rest/v1/v_trend?order=week.asc');
  },

  async getRepeatOffenders(): Promise<RepeatOffender[]> {
    return supaFetch<RepeatOffender[]>('/rest/v1/v_repeat_offenders');
  },

  async escalateOverdue(): Promise<number> {
    return supaFetch<number>('/rest/v1/rpc/escalate_overdue', { method: 'POST' });
  },

  async simulateDays(n: number): Promise<number> {
    return supaFetch<number>('/rest/v1/rpc/simulate_days', {
      method: 'POST',
      body: JSON.stringify({ n })
    });
  },

  async resetDemo(): Promise<void> {
    // Reset is a mock/local function
  }
};
