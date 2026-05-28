# Roland Project Memory

_Updated automatically after each run. Edit manually at any time._

## Architecture Decisions

- Fastify chosen over Express for plugin system and native TypeScript support
- Layered folder structure (`domain/`, `application/`, `adapters/`, `infrastructure/`) established from day one
- Prisma models defined early with cascade deletes on User/Project/Task
- Uses Fastify (not Express) — chosen for plugin ecosystem and TypeScript support
- Zod validates all request/response boundaries; no manual type coercion
- Repository interfaces live in `infrastructure/*/types.ts` (codebase-wide pattern)
- JWT `sub` claim is the sole source of `userId`; never read from request body

## Coding Standards

- All imports use `.js` extension even in `.ts` files
- Routes exported as `FastifyPluginCallback` from `src/routes/*.ts`
- `buildServer()` factory pattern for testability
- Routes in `src/routes/{domain}.ts`; controllers in `src/adapters/{domain}/`
- Domain entities are immutable; `update()` returns a new instance
- Integration tests use vitest + in-memory repos; SQLite only for repository integration tests
- All imports use ESM `.js` extensions; no `require`

## Past Mistakes

- Never call `req.destroy()` before sending error JSON response
- `.eslintrc` must be `.cjs` when package type is `module`
- Blackboard/task tracker left inconsistent after implementation — root cause: code completion verified without updating task states; example: core auth tasks remained pending after `meRoutes`, JWT middleware, and tests were fully wired.
- Never call `req.destroy()` before sending the HTTP response — send the error JSON first
- Always include a unique `jti` claim in every JWT access token
- Do not mutate shared state across parallel agents — coordinate via explicit handoff

## Preferences

- Strict TypeScript + no `any`; prefer `unknown` + type guards
- Vitest with `passWithNoTests: true` during skeleton phase
- Use per-test SQLite `:memory:` (or Vitest `poolOptions.threads.singleThread`) for DB integration tests to guarantee isolation.
- TypeScript strict mode — never use `any`; use `unknown` + type guards
- One test file per operation for repository unit tests (e.g., `save.test.ts`, `update.test.ts`)
- Keep `DECISIONS.md` and `ARCHITECTURE.md` as single sources of truth for design choices

## Project Gotchas

- Prisma integration tests require a running PostgreSQL instance at localhost:5432; `createPrismaTestContext` throws `PrismaClientInitializationError` when Docker is unavailable or not in PATH (task-repository.integration.test.ts:32)
- Shared file-based SQLite (`tests/.data/flowforge-test.sqlite`) + `deleteMany` does not isolate tests under Vitest parallelism, causing intermittent FK and missing-record failures.

## Proven Patterns

- `buildServer()` + `app.inject()` pattern enables fast integration tests without starting a real server
- Dedicated `prisma/schema.test.prisma` + `createTestDatabase` helper lets integration tests run locally without Postgres or Docker.
- `prisma-test-context` fixture + `PrismaClient` per test cleanly manages schema push, seeding, and cleanup for repository tests.
- Parallel test-author tasks per layer (unit/integration/E2E) — maximises concurrency, each agent stays focused
- In-memory repositories for HTTP integration tests — removes DB dependency from auth matrix tests
- Replace full `toProps()` equality checks with explicit field assertions when Prisma mock records differ in shape from the domain entity — produces clearer, resilient tests.

## Anti-Patterns

- Forgetting to register routes after creating the plugin file — root cause: missing `app.register()` call; example: health route would have been unreachable without the explicit register in `server.ts`
- Writing repository integration tests without an explicit DB-setup prerequisite in the task plan — root cause: environment assumed ready; example: 14 new tests authored but blocked from execution this run
- Assuming shared SQLite file with `deleteMany` cleanup suffices for parallel test isolation — root cause: default Vitest worker model ignored; example: `task-repository.integration.test.ts` FK violations under concurrency.
- Passing the wrong object shape to a helper — root cause: mismatched call-site vs helper signature; example: `createOwnedProject(testApp.app, ...)` when helper expects `AuthTestApp`
- Overly broad mock assertions — root cause: asserting full `toProps()` equality when mock defaults differ from the entity under test
- Overly broad `toProps()` assertions on partial mocks (root cause: assuming mock defaults match entity shape; example: the update.test.ts failure fixed this run).

---

_Last updated: 2026-05-27 · run mpopw08q · Fix the failing toProps() mock assertion in src/infrastructu_
