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
import { mockApi } from './mockApi';
import { serverApi } from './serverApi';
import { supabaseApi } from './supabaseApi';
import { isSupabaseConfigured } from './supabase';

export interface Api {
  signIn(email: string): Promise<Session>;
  signOut(): Promise<void>;
  getSession(): Session | null;
  listColleges(): Promise<College[]>;
  listCells(): Promise<Cell[]>;
  createComplaint(input: {
    college_id: number;
    original_text: string;
    files: { name: string; size: number; type: string }[];
  }): Promise<Complaint>;
  listMyComplaints(): Promise<Complaint[]>;
  getComplaintByCode(code: string): Promise<ComplaintDetail>;
  trackByCode(code: string): Promise<PublicTrack | null>;
  listCases(filter: {
    cell_id?: number;
    status?: string;
    college_id?: number;
    overdueOnly?: boolean;
  }): Promise<CaseRow[]>;
  updateCase(
    id: string,
    patch: { status?: Status; note?: string; notice?: boolean }
  ): Promise<void>;
  similarCases(id: string): Promise<CaseRow[]>;
  listNotifications(): Promise<NotificationRow[]>;
  getKpis(): Promise<Kpis>;
  getByCollege(): Promise<CollegeStats[]>;
  getByCell(): Promise<CellStats[]>;
  getByCategory(): Promise<CategoryStats[]>;
  getTrend(): Promise<TrendStats[]>;
  getRepeatOffenders(): Promise<RepeatOffender[]>;
  escalateOverdue(): Promise<number>;
  simulateDays(n: number): Promise<number>;
  resetDemo(): Promise<void>;
}

export type BackendProvider = 'server' | 'supabase' | 'mock';

// Priority:
// 1. Explicit VITE_BACKEND=server or VITE_API_URL set -> serverApi
// 2. isSupabaseConfigured -> supabaseApi
// 3. Fallback -> mockApi
export function getActiveBackendProvider(): BackendProvider {
  if (import.meta.env.VITE_BACKEND === 'server' || import.meta.env.VITE_API_URL) {
    return 'server';
  }
  if (isSupabaseConfigured) {
    return 'supabase';
  }
  return 'mock';
}

function resolveActiveApi(): Api {
  const provider = getActiveBackendProvider();
  if (provider === 'server') {
    return serverApi;
  }
  if (provider === 'supabase') {
    return supabaseApi;
  }
  return mockApi;
}

// Resilient wrapper with automatic graceful fallback to mockApi if backend is temporarily unreachable
const targetApi = resolveActiveApi();

export const api: Api = new Proxy(targetApi, {
  get(target, prop, receiver) {
    const origMethod = (target as any)[prop];
    if (typeof origMethod === 'function') {
      return async function (...args: any[]) {
        try {
          return await origMethod.apply(target, args);
        } catch (err: any) {
          // If server or supabase failed due to network / connection refusal, fall back to mock
          const msg = String(err?.message || '');
          if (
            msg.includes('Failed to fetch') ||
            msg.includes('NetworkError') ||
            msg.includes('connection refused') ||
            msg.includes('Server error (502)')
          ) {
            console.warn(`[AICTE API] Backend request failed, falling back to local mock layer: ${String(prop)}`, err);
            const fallbackMethod = (mockApi as any)[prop];
            if (typeof fallbackMethod === 'function') {
              return await fallbackMethod.apply(mockApi, args);
            }
          }
          throw err;
        }
      };
    }
    return Reflect.get(target, prop, receiver);
  }
});
