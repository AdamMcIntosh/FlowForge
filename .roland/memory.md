# Roland Project Memory

_Updated automatically after each run. Edit manually at any time._

## Architecture Decisions

- Fastify chosen over Express for plugin system and native TypeScript support
- Layered folder structure (`domain/`, `application/`, `adapters/`, `infrastructure/`) established from day one
- Prisma models defined early with cascade deletes on User/Project/Task

## Coding Standards

- All imports use `.js` extension even in `.ts` files
- Routes exported as `FastifyPluginCallback` from `src/routes/*.ts`
- `buildServer()` factory pattern for testability

## Past Mistakes

- Never call `req.destroy()` before sending error JSON response
- `.eslintrc` must be `.cjs` when package type is `module`
- Blackboard/task tracker left inconsistent after implementation — root cause: code completion verified without updating task states; example: core auth tasks remained pending after `meRoutes`, JWT middleware, and tests were fully wired.

## Preferences

- Strict TypeScript + no `any`; prefer `unknown` + type guards
- Vitest with `passWithNoTests: true` during skeleton phase

## Project Gotchas

_No entries yet._

## Proven Patterns

- `buildServer()` + `app.inject()` pattern enables fast integration tests without starting a real server

## Anti-Patterns

- Forgetting to register routes after creating the plugin file — root cause: missing `app.register()` call; example: health route would have been unreachable without the explicit register in `server.ts`

---

_Last updated: 2026-05-27 · run mpokxe28 · Add protected route middleware and a sample protected /me en_
