

# AI Mock Interview Platform — Build Plan

## Phase 1: Foundation
- **Enable Lovable Cloud** for Supabase (auth, database, edge functions)
- **Database schema** via migrations:
  - `profiles` (id, name, email, created_at) with trigger on auth signup
  - `interviews` (id, user_id, role, difficulty, status, total_score, violations_count, started_at, completed_at)
  - `questions` (id, interview_id, question_text, question_type, order_index, time_limit_seconds)
  - `responses` (id, question_id, interview_id, user_answer, score, feedback, correct_answer, submitted_at)
  - RLS policies on all tables scoped to authenticated user

## Phase 2: Auth & Layout
- Login/signup pages with email+password via Supabase Auth
- Protected route wrapper, app layout with sidebar navigation
- Dark professional theme (dark bg, blue/purple accents)

## Phase 3: Dashboard
- Dynamic stats: total interviews, average score, best score
- Recent interviews list, performance chart over time (Recharts)
- All data fetched from database for the logged-in user

## Phase 4: Interview Setup & Instructions
- Role selector (Java, Python, Web Dev, AI/ML, etc.) and difficulty selector
- Pre-interview instructions page with camera/mic/rules checklist
- "I agree to terms" checkbox gates the Start button
- Camera/mic permission request on start

## Phase 5: AI Question Generation (Edge Function)
- Edge function `generate-questions` calls Lovable AI to produce 5-10 unique questions per session
- Mix of technical theory, coding, and HR questions based on role + difficulty
- Questions stored in database linked to interview

## Phase 6: Interview Flow & Proctoring
- One question at a time with per-question countdown timer
- Live webcam preview (presence check only, no recording)
- Proctoring: tab switch detection (visibilitychange), disable right-click/copy/paste
- Violation counter with warnings; auto-submit on 3+ violations
- CodeMirror editor for coding questions, textarea for others

## Phase 7: AI Evaluation (Edge Function)
- Edge function `evaluate-answers` sends each answer to Lovable AI for scoring (0-10)
- Evaluates correctness, logic, clarity; generates feedback + correct answer

## Phase 8: Results & History
- Results page: total score, per-question breakdown, feedback, correct answers
- Learning recommendations based on weak areas (LeetCode, HackerRank, GFG, etc.)
- Interview history page with filters, click to view detailed past reports

## Technical Details
- **Frontend**: React + TypeScript + Tailwind (dark theme via CSS variables) + shadcn/ui
- **Backend**: Supabase (Lovable Cloud) — Auth, PostgreSQL, Edge Functions
- **AI**: Lovable AI Gateway via edge functions (google/gemini-3-flash-preview)
- **Charts**: Recharts (already available via chart.tsx)
- **Code Editor**: CodeMirror (install @uiw/react-codemirror)
- ~15 new files: 7 pages, 2 edge functions, 3-4 migrations, hooks/utils

