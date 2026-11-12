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
import { getStoredSession, setStoredSession } from './session';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  if (session?.user?.role) {
    headers['x-demo-role'] = session.user.role;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let errorMsg = `Server error (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}

export const serverApi: Api = {
  async signIn(email: string): Promise<Session> {
    const res = await request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    const session: Session = {
      user: res.user,
      token: res.token
    };
    setStoredSession(session);
    return session;
  },

  async signOut(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout failure
    }
    setStoredSession(null);
  },

  getSession(): Session | null {
    return getStoredSession();
  },

  async listColleges(): Promise<College[]> {
    return request<College[]>('/colleges');
  },

  async listCells(): Promise<Cell[]> {
    return request<Cell[]>('/cells');
  },

  async createComplaint(input: {
    college_id: number;
    original_text: string;
    files: { name: string; size: number; type: string }[];
  }): Promise<Complaint> {
    return request<Complaint>('/complaints', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async listMyComplaints(): Promise<Complaint[]> {
    return request<Complaint[]>('/complaints/my');
  },

  async getComplaintByCode(code: string): Promise<ComplaintDetail> {
    return request<ComplaintDetail>(`/complaints/${encodeURIComponent(code)}`);
  },

  async trackByCode(code: string): Promise<PublicTrack | null> {
    try {
      return await request<PublicTrack>(`/track/${encodeURIComponent(code)}`);
    } catch (err: any) {
      if (err.message && err.message.includes('404')) return null;
      throw err;
    }
  },

  async listCases(filter: {
    cell_id?: number;
    status?: string;
    college_id?: number;
    overdueOnly?: boolean;
  }): Promise<CaseRow[]> {
    const params = new URLSearchParams();
    if (filter.cell_id) params.set('cell_id', String(filter.cell_id));
    if (filter.status && filter.status !== 'All') params.set('status', filter.status);
    if (filter.college_id) params.set('college_id', String(filter.college_id));
    if (filter.overdueOnly) params.set('overdueOnly', 'true');

    const qs = params.toString();
    return request<CaseRow[]>(`/cases${qs ? `?${qs}` : ''}`);
  },

  async updateCase(
    id: string,
    patch: { status?: Status; note?: string; notice?: boolean }
  ): Promise<void> {
    await request(`/cases/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
  },

  async similarCases(id: string): Promise<CaseRow[]> {
    return request<CaseRow[]>(`/cases/${encodeURIComponent(id)}/similar`);
  },

  async listNotifications(): Promise<NotificationRow[]> {
    return request<NotificationRow[]>('/notifications');
  },

  async getKpis(): Promise<Kpis> {
    return request<Kpis>('/analytics/kpis');
  },

  async getByCollege(): Promise<CollegeStats[]> {
    return request<CollegeStats[]>('/analytics/by-college');
  },

  async getByCell(): Promise<CellStats[]> {
    return request<CellStats[]>('/analytics/by-cell');
  },

  async getByCategory(): Promise<CategoryStats[]> {
    return request<CategoryStats[]>('/analytics/by-category');
  },

  async getTrend(): Promise<TrendStats[]> {
    return request<TrendStats[]>('/analytics/trend');
  },

  async getRepeatOffenders(): Promise<RepeatOffender[]> {
    return request<RepeatOffender[]>('/analytics/repeat-offenders');
  },

  async escalateOverdue(): Promise<number> {
    const res = await request<{ escalated: number }>('/escalate-overdue', {
      method: 'POST'
    });
    return res.escalated;
  },

  async simulateDays(n: number): Promise<number> {
    const res = await request<{ escalated: number }>('/simulate-days', {
      method: 'POST',
      body: JSON.stringify({ days: n })
    });
    return res.escalated;
  },

  async resetDemo(): Promise<void> {
    await request('/reset-demo', { method: 'POST' });
  }
};
