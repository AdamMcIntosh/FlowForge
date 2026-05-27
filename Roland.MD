# FlowForge — Roland Instructions

## Core Constraints
- This is an **ESM-only** TypeScript project (`"type": "module"` in package.json)
- All imports must use `.js` extensions (even for `.ts` files)
- Use strict TypeScript (`"strict": true`)
- Never use `any` — prefer `unknown` + proper type guards
- Prefer narrow, focused tasks over large sequential ones
- Always split test writing (`test-author`) from test execution (`test-executor`)

## Architecture Preferences
- Backend: Clean Architecture (Domain → Application → Adapters → Infrastructure)
- Use Dependency Injection via factories
- Validation: Zod everywhere
- Database: Prisma + PostgreSQL
- Auth: JWT with refresh tokens (RS256 preferred)
- Rate limiting on all public endpoints

## Testing Standards
- Unit tests for business logic
- Integration tests for API endpoints + rate limiting
- Test-author writes tests; test-executor runs them
- Never combine test writing and execution in one task

## Preferences
- Lead PM uses Grok 4.3
- All other agents use Composer 2.5
- Prefer early rate-limit checks (before body parsing)
- Keep API responses consistent and secure (no enumeration leaks)
- Document all major decisions in ARCHITECTURE.md and DECISIONS.md

## Anti-Patterns (Never Do)
- Mixing concerns in controllers
- Using shared test server instances without proper isolation
- Leaving rate limit keys in constants without wiring them
- Creating duplicate test files