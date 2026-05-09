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

## Phase 1: Project Skeleton

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

## Phase 2: Configuration

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

## Phase 3: Prisma Schema

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

## Phase 4: Core Interfaces

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

## Phase 5: File Scanner and Language Detection

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

## Phase 6: Context Resolvers

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

## Phase 7: Questions and Bundle Building

1. Add core question services under `src/core/questions/`.
2. Add bundle builder under `src/core/bundles/`.
3. Register available context resolvers.
4. For each source file:

- choose the first resolver that supports it
- build one `AnalysisBundle`
- persist the bundle and metadata

5. Add the initial COBOL question set.
6. Pilot target: 10 files and 3 questions.

## Phase 8: Job Generation

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

## Phase 9: Database-Backed Queue

1. Implement job claiming with PostgreSQL row locking.
2. Use `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction.
3. Avoid naive two-step select-then-update logic.
4. Add a repository method such as `claimNextJobs(limit)`.
5. Mark claimed jobs as `running` in the same transaction.
6. Add retry handling:

- retry transient provider and filesystem failures
- do not retry deterministic validation or configuration failures

7. Add stale job recovery in `src/worker/recoverStaleJobs.ts`.

## Phase 10: Worker

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

## Phase 11: Workspace Builder

1. Add `src/worker/WorkspaceBuilder.ts`.
2. Create one workspace per job under `tmp/workspaces/`.
3. Copy only:

- main source file
- resolved context files

4. Preserve relative paths where possible.
5. Do not expose unrelated repository files to providers.
6. Clean up workspaces after completion unless debug retention is enabled.

## Phase 12: Bob Shell Provider

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

## Phase 13: REST API

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

## Phase 14: Exports

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

## Phase 15: Tests

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

## Phase 16: Pilot Workflow

1. Prepare a pilot repository or fixture with at least 10 COBOL files.
2. Scan the repository.
3. Build bundles.
4. Generate jobs for 10 files and 3 questions.
5. Run jobs through Bob Shell provider if configured.
6. Store answers.
7. Export JSON, CSV, and Markdown results.
8. Review failures, unresolved dependencies, and parse quality.

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
