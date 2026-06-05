# Agent Handoff Log
_Shared between Claude Code and any other agent working on this repo. Read before starting. Append after finishing._

---

## Project context
`codebase-analysis-orchestrator` (v0.1.0) — Node.js/TypeScript backend orchestrating AI-powered batch analysis of software repositories. Master's thesis artifact, Sapienza Università di Roma.

**Stack:** Node.js · TypeScript · Prisma/PostgreSQL · Express · React (web UI) · Ink (TUI) · Vitest  
**Run tests:** `npm test` (257 pass / 3 skipped by design — must stay green)  
**Migrate schema:** `npx prisma migrate dev` (never edit DB directly)

### Architecture
```
Projects → SourceFiles → AnalysisBundles → AnalysisJobs → AnalysisAnswers → Exports
                                                 ↑
                                           WorkerLoop (polling, concurrent)
                                                 ↑
                                         ProviderRegistry
                                        /       |        \
                                     stub      bob     opencode
```

### Providers
- `stub` — deterministic fake, tests only
- `bob` — HTTP shell provider
- `opencode` — runs `opencode` CLI via PTY (`script -qec`); hydrates output from opencode SQLite DB if stdout lacks structured JSON

### Feature backlog (pick the first unchecked item)
- [ ] **Provider comparison view** — `/runs/:id/compare` page, side-by-side answers for same file+question across providers
- [ ] **Answer rating** — `rating Int?` on `AnalysisAnswer`, `PATCH /api/answers/:id/rating`, star widget in `RunPage.tsx`
- [ ] **Incremental re-analysis** — skip job creation in `jobGenerator.ts` when a completed answer exists for same `(bundleId, questionId, providerId)` and checksum unchanged
- [ ] **More language support** — JCL or PL/I: detector rule in `LanguageDetector.ts`, resolver under `src/languages/`, question seed array
- [ ] **Real-time SSE** — `GET /api/runs/:id/stream` pushing job-completion events; remove polling from web UI

---

agent: claude-sonnet-4-6
task: Audit project state, identify uncommitted work, suggest next features, create handoff.md
files_changed: handoff.md
why: User asked what was left to do and what features to build next. Audited git status and produced a ranked feature backlog. Created this handoff file so future agents can pick up without re-deriving state.
status: done
next: |
  Pending decisions before committing:
  - COBOL_TEST/ (untracked: ORDPROC.CBL, CUSTOMER.CPY, ORDERREC.CPY, PRICING.CPY) — ask user: commit as fixture or add to .gitignore?

  Once decided, commit all of the following in one go (tests already pass):
  - src/providers/opencode/OpenCodeShellProvider.ts
  - src/providers/opencode/OpenCodeShellProvider.test.ts
  - src/core/answers/answerSummary.ts  (new file)
  - src/worker/WorkerLoop.ts
  - src/web/types.ts
  - src/web/pages/RunPage.tsx
  - src/web/pages/tabs/RunsTab.tsx
  - src/tui/screens/RunScreen.tsx
  - COBOL_TEST/ (if user says commit)

  Then push — branch is 7 commits ahead of origin/main, not pushed yet.

  After push: pick first unchecked feature from the backlog above.

  Watch out:
  - answerSummary() was added but not back-applied to TUI detail views, only list view. Check for remaining raw a.rawOutput references when adding new answer views.
  - OpenCode hydrateOpenCodeStdout() calls `opencode db` as a subprocess with a 10s sub-timeout. Keep in mind when touching timeouts.
  - Worker logs are suppressed under NODE_ENV=test — never use bare console.log in WorkerLoop, always logWorker().
timestamp: 2026-05-20T12:14:00+02:00

---

### What was built in the session above (detail)

| File | What changed |
|---|---|
| `src/providers/opencode/OpenCodeShellProvider.ts` | PTY execution via `script -qec`; `hydrateOpenCodeStdout()` queries opencode SQLite DB as fallback when stdout lacks structured JSON; exports `extractOpenCodeSessionId` + `buildOpenCodePartsQuery` |
| `src/providers/opencode/OpenCodeShellProvider.test.ts` | 36 lines of new tests for the hydration helpers |
| `src/core/answers/answerSummary.ts` | New file — `answerSummary(parsed, rawOutput)` extracts human-readable summary: tries parsed fields first (`answer`, `summary`, `purpose`, `description`, `text`), falls back to last non-empty text event in the raw event stream |
| `src/worker/WorkerLoop.ts` | `logWorker()` + `formatResultInfo()` — logs job claimed / started (with model override) / done (tokens + duration) / retry / failed; silenced under `NODE_ENV=test` |
| `src/web/types.ts` | Added `metadata?: Record<string, unknown>` to `AnalysisRun` |
| `src/web/pages/RunPage.tsx` | Shows `model`/`agent` from `run.metadata.providerSettings`; uses `answerSummary()`; `JobRow` now shows `failureKind` badge, full error text, and `providerId` |
| `src/web/pages/tabs/RunsTab.tsx` | Provider input replaced with `<Select>` dropdown populated from providers health API |
| `src/tui/screens/RunScreen.tsx` | Uses `answerSummary()` instead of raw output in answer list |
