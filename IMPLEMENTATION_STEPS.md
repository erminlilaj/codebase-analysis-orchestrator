# Implementation Steps

This file lists the recommended build order for
`codebase-analysis-orchestrator`.

The goal is to build a backend orchestration system that can process thousands
of repository files by decomposing work into durable, retryable analysis jobs.

Accepted stack decisions:

- Package manager: npm
- Runtime: Node.js
- Language: TypeScript
- HTTP framework: Fastify
- ORM: Prisma
- Database: PostgreSQL
- Test framework: Vitest
- Queue strategy for milestone 1: PostgreSQL-backed queue using
  `SELECT ... FOR UPDATE SKIP LOCKED`
- Future queue option: Redis/BullMQ, deferred

## Phase 1: Project Skeleton — [done]

1. Create `package.json` with npm scripts.
2. Add TypeScript configuration in `tsconfig.json`.
3. Add Vitest configuration in `vitest.config.ts`.
4. Add linting and formatting only if needed for the first milestone.
5. Create the initial source tree:

```text
src/
  api/
  config/
  core/
  db/
  languages/
  providers/
  worker/
prisma/
docs/
exports/
tmp/workspaces/
```

6. Update `.gitignore` for generated and local-only files:

- `node_modules/`
- `dist/`
- `.env`
- `exports/`
- `tmp/`
- Prisma local artifacts if needed

## Phase 2: Configuration — [done]

1. Add `src/config/env.ts`.
2. Validate environment variables at startup.
3. Required first variables:

```text
DATABASE_URL
PORT
BOBSHELL_API_KEY
BOB_COMMAND
WORKSPACE_ROOT
EXPORT_ROOT
JOB_MAX_ATTEMPTS
JOB_STALE_TIMEOUT_SECONDS
WORKER_POLL_INTERVAL_MS
WORKER_CONCURRENCY
```

4. Keep secrets out of logs and exports.

## Phase 3: Prisma Schema — [done]

1. Create `prisma/schema.prisma`.
2. Model generic core entities only:

- `Project`
- `SourceFile`
- `DependencyLink`
- `AnalysisBundle`
- `Question`
- `AnalysisRun`
- `AnalysisJob`
- `AnalysisAnswer`
- `Export`

3. Add job status enum:

```text
queued
running
succeeded
failed
retrying
cancelled
```

4. Add indexes for large repository processing:

- `SourceFile.projectId`
- `SourceFile.projectId + relativePath`
- `SourceFile.projectId + language`
- `AnalysisJob.status`
- `AnalysisJob.status + createdAt`
- `AnalysisJob.runId`
- `AnalysisJob.providerId`
- `AnalysisAnswer.jobId`

5. Use JSON fields for provider-specific and resolver-specific metadata.
6. Do not add COBOL-specific or Bob-specific database models.

## Phase 4: Core Interfaces — [done]

1. Add `src/languages/common/types.ts`.
2. Add `src/languages/common/ContextResolver.ts`.
3. Add `src/providers/common/types.ts`.
4. Add `src/providers/common/AnalysisProvider.ts`.
5. Keep all shared names generic:

- `SourceFile`
- `AnalysisBundle`
- `Question`
- `AnalysisJob`
- `AnalysisAnswer`
- `AnalysisProvider`

6. Do not add `BobJob`, `BobAnswer`, `CobolFile`, or `CopybookLink` to core.

## Phase 5: File Scanner and Language Detection — [done]

1. Implement a repository file scanner under `src/core/files/`.
2. Stream or batch filesystem traversal; do not load huge file lists into memory
   unnecessarily.
3. Ignore:

- `.git/`
- `node_modules/`
- build outputs
- dependency folders
- `tmp/`
- `exports/`
- configured exclude patterns

4. Store relative paths, size, checksum, extension, and detected language.
5. Add `src/languages/common/LanguageDetector.ts`.
6. Detect COBOL extensions first:

- `.cob`
- `.cbl`
- `.cpy`
- `.copy`
- `.pco`

7. Unknown files should fall back to `generic`.

## Phase 6: Context Resolvers — [done]

1. Implement `src/languages/generic/GenericResolver.ts`.
2. Generic resolver returns:

- main file
- no context files by default
- no unresolved dependencies
- metadata showing fallback resolution was used

3. Implement COBOL resolver under `src/languages/cobol/`.
4. Add:

- `CobolResolver.ts`
- `parseCopyStatements.ts`
- `resolveCopybooks.ts`
- `cobolQuestions.ts`

5. COBOL resolver should parse `COPY` statements and resolve copybooks against
   known `SourceFile` records.
6. Store unresolved copybooks in `unresolvedDependencies`.
7. Keep COBOL-specific details in bundle metadata, not core models.

## Phase 7: Questions and Bundle Building — [done]

1. Add core question services under `src/core/questions/`.
2. Add bundle builder under `src/core/bundles/`.
3. Register available context resolvers.
4. For each source file:

- choose the first resolver that supports it
- build one `AnalysisBundle`
- persist the bundle and metadata

5. Add the initial COBOL question set.
6. Pilot target: 10 files and 3 questions.

## Phase 8: Job Generation — [done]

1. Add job generation under `src/core/jobs/`.
2. Generate jobs using this unit:

```text
main source file + resolved context files + one question + one provider
```

3. Do not generate jobs that send the whole repository.
4. Persist jobs with:

- project id
- run id
- bundle id
- main source file id
- question id
- provider id
- status
- attempt count
- max attempts
- timestamps

5. Ensure job generation can handle thousands of files without creating all
   transient objects in memory at once.

## Phase 9: Database-Backed Queue — [done]

1. Implement job claiming with PostgreSQL row locking.
2. Use `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction.
3. Avoid naive two-step select-then-update logic.
4. Add a repository method such as `claimNextJobs(limit)`.
5. Mark claimed jobs as `running` in the same transaction.
6. Add retry handling:

- retry transient provider and filesystem failures
- do not retry deterministic validation or configuration failures

7. Add stale job recovery in `src/worker/recoverStaleJobs.ts`.

## Phase 10: Worker — [done]

1. Add `src/worker/WorkerLoop.ts`.
2. Add a separate worker entrypoint, for example:

```text
npm run dev:worker
```

3. Worker responsibilities:

- claim jobs
- build a temporary workspace
- invoke provider adapter
- parse and validate output
- persist answer
- update job status
- retry or fail jobs

4. Keep worker process separate from the API process.
5. Make worker concurrency configurable.

## Phase 11: Workspace Builder — [done]

1. Add `src/worker/WorkspaceBuilder.ts`.
2. Create one workspace per job under `tmp/workspaces/`.
3. Copy only:

- main source file
- resolved context files

4. Preserve relative paths where possible.
5. Do not expose unrelated repository files to providers.
6. Clean up workspaces after completion unless debug retention is enabled.

## Phase 12: Bob Shell Provider — [next]

1. Add Bob-specific code only under `src/providers/bob/`.
2. Add:

- `BobShellProvider.ts`
- `buildBobPrompt.ts`
- `parseBobOutput.ts`

3. Integrate through the Bob Shell CLI only.
4. Use non-interactive invocation:

```sh
bob --auth-method api-key -p "..."
```

5. Use `BOBSHELL_API_KEY` from the environment.
6. Build prompts using Bob-compatible file references:

```text
@relative/path/to/file.cbl
```

7. Capture:

- stdout
- stderr
- exit code
- timeout state
- duration
- command metadata safe to store

8. Invest in `parseBobOutput.ts` carefully. CLI output may be inconsistent.
9. Unit tests should mock child process execution and must not require a real Bob
   installation.

## Phase 13: REST API — [complete]

1. Add Fastify server in `src/api/server.ts`.
2. Add route modules:

- `projects.routes.ts`
- `files.routes.ts`
- `bundles.routes.ts`
- `questions.routes.ts`
- `jobs.routes.ts`
- `answers.routes.ts`
- `exports.routes.ts`

3. Initial capabilities:

- register project
- scan project
- list files
- build bundles
- manage questions
- create analysis run
- generate jobs
- inspect job status
- retrieve answers
- create exports

4. Keep API paths generic. Do not expose Bob- or COBOL-specific paths unless a
   plugin administration feature requires it.

## Phase 14: Exports — [complete]

1. Add export logic under `src/core/exports/`.
2. Implement:

- JSON
- CSV
- Markdown

3. Export from stored database answers, not live provider calls.
4. Use streaming output for large runs.
5. Include traceability:

- project
- run
- source file
- question
- provider
- job status
- answer
- error state

## Phase 15: Tests — [partial]

1. Add unit tests for:

- language detection
- COBOL `COPY` parsing
- copybook resolution
- generic resolver fallback
- bundle generation
- job generation cardinality
- job state transitions
- queue claim behavior
- Bob prompt building
- Bob output parsing
- export formatting

2. Mock provider execution in unit tests.
3. Add integration tests for database behavior once Prisma is configured.
4. The queue claim test should verify concurrent workers do not claim the same
   job.

## Phase 16: Pilot Workflow — [pending]

1. Prepare a pilot repository or fixture with at least 10 COBOL files.
2. Scan the repository.
3. Build bundles.
4. Generate jobs for 10 files and 3 questions.
5. Run jobs through Bob Shell provider if configured.
6. Store answers.
7. Export JSON, CSV, and Markdown results.
8. Review failures, unresolved dependencies, and parse quality.

## Immediate Plan Before Real Bob Execution

Research basis:

- IBM documents IBMid/browser login for interactive sessions.
- IBM documents API-key authentication for automation, CI/CD, scheduled
  workflows, and non-interactive sessions.
- IBM documents `@file` references for project context.
- The public Bob Shell CLI docs list `--accept-license`, `--chat-mode`, and
  `--hide-intermediary-output`, but do not currently settle the
  `--output-format stream-json` contract. Treat stream parsing as a fixture-
  and installed-CLI-verified behavior, not as a public-doc guarantee.

### Phase A: Harden the Existing Stub Pipeline

Before integrating real Bob execution, verify the whole internal path with a
single integration test against a fixture repo and `StubProvider`:

```text
scan -> bundle -> job generation -> worker -> answer storage -> export
```

The integration test is the source of truth. Add or tighten supporting tests
where they are missing:

- job status transitions
- retry behavior
- failed job behavior
- stale running job recovery
- answer persistence
- export correctness

This protects the orchestration architecture before adding a networked external
provider.

### Phase B: Add Bob Prompt Builder — [done]

Create:

```text
src/providers/bob/BobPromptBuilder.ts
```

Status:

- `[done]` `BobPromptBuilder.ts` supports `file-reference` and
  `inline-content` prompt modes.
- `[done]` Inline mode reads isolated workspace files and rejects over-limit
  content without truncation.
- `[done]` Unit coverage lives in `src/providers/bob/BobPromptBuilder.test.ts`.

The prompt builder should take:

- main file
- context files
- language
- question
- bundle metadata
- unresolved dependencies
- expected JSON schema
- prompt file mode
- max inline bytes

It must produce deterministic prompts and be covered by fixtures or snapshots.
Do not put Bob prompt construction in the worker. The worker should only build
the workspace and call the provider interface (`analyze` in the current code).

Support two file modes from the beginning:

```ts
type PromptFileMode = 'file-reference' | 'inline-content';
```

File-reference mode:

```text
Main file: @PROGRAM.cbl
Context file: @COPYBOOK.cpy
```

Inline-content mode:

````text
Main file content:
```cobol
...
```
````

Defaults:

- Bob runtime default: `file-reference`
- local/unit-test default: `inline-content` or fixture content
- max inline content size: 50 KB total bundle size by default

Large real jobs should prefer file-reference mode. Unit tests and parser
fixtures should prefer inline content because they do not depend on Bob's file
resolution behavior. Never silently truncate source files. If inline mode
exceeds `provider.maxInlineBytes`, reject with a clear error and require
file-reference mode.

Expected provider answer schema:

```json
{
  "answer": "string",
  "confidence": "high|medium|low",
  "evidence": [
    {
      "file": "string",
      "location": "string",
      "symbol": "string|null",
      "explanation": "string"
    }
  ],
  "unresolved": ["string"],
  "missingContext": ["string"]
}
```

Use `unresolved`, not `unresolvedDependencies`, in the provider answer because
it is shorter and language-agnostic. Keep main file, language, and question
metadata outside the provider answer because the job already owns them.

### Phase C: Add Bob Output Parser — [done]

Create:

```text
src/providers/bob/BobOutputParser.ts
```

Status:

- `[done]` `BobOutputParser.ts` preserves raw output and returns structured
  parse metadata.
- `[done]` It handles strict JSON, embedded JSON, NDJSON
  `attempt_completion`, malformed JSON, empty stdout, stderr-only failure, and
  timeout metadata.
- `[done]` Fixture-based tests live in
  `src/providers/bob/BobOutputParser.test.ts` and do not require Bob Shell or
  credentials.

The parser must always preserve raw output. It should handle:

- strict JSON
- JSON surrounded by explanatory text
- stream JSON / NDJSON fixture output, if available
- malformed JSON
- empty output
- stderr-only failure
- timeout failure metadata

Parser tests must use saved fixture outputs and must not require a real Bob
installation or credentials. If real Bob outputs exist, save them immediately
for normal CLI output, `--hide-intermediary-output`, and any attempted
`stream-json` run. If no real outputs exist, create synthetic fixtures clearly
marked as synthetic. Include malformed and partial output fixtures.

### Phase D: Add Disabled-By-Default Bob Provider Scaffolding

Create the provider structure, but keep real execution disabled unless it is
explicitly configured and ready.

Status:

- `[done]` Bob provider configuration is validated in `src/config/envSchema.ts`
  and exposed through `projectConfig.bob`.
- `[done]` Provider health shape and optional `AnalysisProvider.health()` are
  implemented.
- `[done]` `StubProvider` reports healthy provider status.
- `[done]` Bob readiness checks live in
  `src/providers/bob/BobProviderHealth.ts` and validate enablement, API key,
  command availability, timeout, buffer, and inline-byte settings.
- `[done]` Run creation rejects unknown or unavailable providers before jobs
  are generated.
- `[pending]` `BobShellProvider` execution adapter still needs to be added.

Required configuration:

```text
BOB_PROVIDER_ENABLED=false
BOB_COMMAND=bob
BOBSHELL_API_KEY=...
BOB_TIMEOUT_MS=180000
BOB_MAX_BUFFER_MB=20
BOB_MAX_INLINE_BYTES=51200
```

Keep `BOB_COMMAND`. It already exists in the codebase, covers PATH lookup,
absolute paths, and wrapper scripts, and is more flexible than `BOB_SHELL_PATH`.

Provider readiness should check:

- provider is explicitly enabled
- shell executable exists or resolves from `PATH`
- `BOBSHELL_API_KEY` exists
- timeout and buffer configuration are valid

Readiness result shape:

```ts
export type ProviderHealth = {
  providerId: string;
  name: string;
  type: 'stub' | 'shell' | 'http' | 'local';
  configured: boolean;
  enabled: boolean;
  available: boolean;
  retryable: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};
```

Keep real Bob execution disabled unless all of these are true:

1. `BOBSHELL_API_KEY` is present.
2. `BOB_COMMAND` resolves.
3. The Bob provider is explicitly enabled.

Extend the provider interface with optional health support so existing providers
remain compatible:

```ts
export interface AnalysisProvider {
  id: string;
  displayName: string;
  analyze(input: ProviderAnalysisInput): Promise<ProviderAnalysisResult>;
  health?(): Promise<ProviderHealth>;
}
```

`StubProvider` should report configured, enabled, available, and non-retryable.
Bob health should check `BOBSHELL_API_KEY`, provider enabled state, valid config,
and `BOB_COMMAND --version`.

Provider availability should be enforced at run creation. If the provider is
unknown, disabled, missing `BOB_COMMAND`, or missing `BOBSHELL_API_KEY`, return
HTTP 400 and do not generate jobs. Allow an explicit `force: true` flag only for
debugging or dry-run workflows.

### Phase E: Add Provider Health Endpoints — [done]

Add:

```text
GET /api/providers
GET /api/providers/:id/health
```

Status:

- `[done]` Provider health endpoints are implemented in
  `src/api/routes/providers.routes.ts`.
- `[done]` Routes are registered under `/api/providers`.
- `[done]` API coverage lives in `src/api/server.test.ts`.

Example response:

```json
{
  "stub": { "enabled": true, "available": true },
  "bob": {
    "enabled": false,
    "available": false,
    "reason": "BOBSHELL_API_KEY not set"
  }
}
```

These endpoints make provider debugging visible without starting a worker or
waiting for a job to fail. Report configured/enabled providers with live
readiness. Also report known-but-disabled providers with static state, but do
not run `health()` for disabled providers.

### Phase F: Failure Classification

Non-retryable failures:

- missing API key
- missing or non-executable command
- unsupported CLI flag
- malformed provider config
- invalid provider ID
- missing workspace
- provider disabled

Retryable failures:

- timeout
- transient process failure
- transient network error
- malformed or partial model output
- parse failure

Classify parse failures as `failureKind: "parse_error"`. They are retryable, but
with a lower cap of two attempts, and should be visible distinctly in exports
and dashboards.

Run creation should block unavailable providers before jobs exist. If readiness
fails during worker execution because config changed or credentials were
revoked, mark the job failed with a non-retryable error. Do not requeue it as
pending. Mark the parent run as blocked with a clear reason when the data model
supports that status.

### Priority Order

Flag legend:

- `[done]`: already implemented and covered by the current test suite.
- `[next]`: highest-priority item to implement next.
- `[pending]`: planned after the current next item.
- `[blocked]`: waits on Bob Shell installation, credentials, or real CLI output.

1. `[P0][done]` Keep `StubProvider` working.
2. `[P0][done]` Keep the fixture-repo stub pipeline demonstrable with
   `npm run e2e`.
3. `[P1][done]` Add `BobPromptBuilder`.
4. `[P1][done]` Add `BobOutputParser`.
5. `[P1][done]` Add fixture-based Bob output parser tests.
6. `[P2][done]` Add Bob provider config validation and readiness checks.
7. `[P2][done]` Extend the provider interface with optional health support
   and make `StubProvider` report health.
8. `[P2][done]` Add provider health endpoints:
   `GET /api/providers` and `GET /api/providers/:id/health`.
9. `[P3][next]` Add disabled-by-default `BobShellProvider` scaffolding.
10. `[P4][blocked]` Test real Bob Shell with an API key and save real CLI
    output fixtures.

## Scale Requirements

Design every phase with thousands of files in mind:

- Use pagination for list APIs.
- Use database indexes from the beginning.
- Avoid loading whole repositories into prompts.
- Avoid loading all jobs into memory.
- Batch inserts where practical.
- Stream exports.
- Make worker concurrency configurable.
- Use atomic queue claiming.
- Preserve job-level traceability.

## Stop Conditions

Before moving beyond the first milestone, confirm:

- Core models are generic.
- COBOL is isolated under `src/languages/cobol/`.
- Bob Shell is isolated under `src/providers/bob/`.
- Jobs are small and provider-neutral.
- Queue claiming is atomic.
- Worker can recover stale jobs.
- Exports work from stored answers.
- Unit tests cover resolver, queue, provider parsing, and exports.
