# Progress log

| Module   | Status                        | Real or mocked | Notes |
| -------- | ----------------------------- | -------------- | ----- |
| M0       | Schema & seed complete        | real SQL files | `supabase/schema.sql` and `supabase/seed.sql` generated and aligned with docs/SCHEMA.md |
| M1       | Foundation, shell, tokens     | real           | Design tokens, typography (Eczar, Anek), tricolour bar, utility strip |
| M2       | Complainant journey           | real           | Landing, 4-step FileComplaint, MyComplaints, CaseDetail, Track |
| M3       | Desk Officer workspace        | real           | OfficerInbox, drawer scrutiny, statutory 7-day notices, overlap detection |
| M4       | Supabase Integration          | real           | `src/lib/supabase.ts`, `src/lib/supabaseApi.ts` with direct PostgREST & Auth calls |
| M5       | Gemini AI & Translation       | real           | `supabase/functions/route-complaint/index.ts` and `server/index.js` AI router |
| M6       | SLA Escalation Engine         | real           | Automated escalation checks, due date shifting simulation, Chairman alerts |
| M7       | Leadership Analytics          | real           | KPI strip, ranked college bars, bureau delays, Recharts trends, repeat offenders |
| M8       | PWA & Accessibility           | real           | A- A A+ scaling, bilingual Hindi/English, WCAG AA, manifest, service worker |
| Backend  | Standalone Node REST Server   | real server    | `server/index.js` zero-dependency REST backend with JSON persistence & Gemini AI |
