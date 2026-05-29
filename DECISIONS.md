# Architecture Decision Records

_Auto-updated by Roland after each run. Edit manually at any time._
_Each section corresponds to one Roland run that produced new decisions._

## 2026-05-29 — Update the FlowForge .NET 10 solution to use SQLite by default for development a _(run mpqzjb77)_

- [Decision: SQLite is the default provider for all non-Production environments; SQL Server is selected only when `Database:Provider=SqlServer` or `ASPNETCORE_ENVIRONMENT=Production`]

## 2026-05-29 — Generate the initial EF Core migration for User, Project, and Task entities and  _(run mpqzno46)_

- [Decision: Startup auto-migration is intentionally skipped in Production so that `dotnet ef database update` (or CI/CD) remains the explicit, auditable mechanism for SQL Server schema changes]

## 2026-05-29 — Add rate limiting middleware to all auth and CRUD endpoints in the FlowForge .NE _(run mpqzsb2o)_

- [Decision: Rate limiting uses ASP.NET Core's built-in AddRateLimiter + fixed-window policy applied uniformly to all auth/CRUD route groups]

## 2026-05-29 — Fix the pre-existing failing InMemoryTaskRepository duplicate-name update test i _(run mpqzw5fd)_

- N/A (no new decisions to record)

## 2026-05-29 — Implement global exception handling and standardize all error responses to use P _(run mpr00vmh)_

- [Decision: Use `IExceptionHandler` + `AddProblemDetails` for all error responses — ensures RFC 7807 compliance and consistent `traceId` without per-endpoint duplication]

## 2026-05-29 — Add input validation using FluentValidation for all Project and Task endpoints i _(run mpr04vwj)_

- [Decision: FluentValidation chosen for request DTO validation with shared NameValidationRules and ProblemDetails error mapping to keep error responses consistent across the API]

## 2026-05-29 — Add input validation using FluentValidation for all Project and Task endpoints i _(run mpr0dk4o)_

- [Decision: Use FluentValidation with shared NameValidationRules for all Project/Task request DTOs — rationale: centralizes length/trim rules and keeps validators thin]

## 2026-05-29 — Add FluentValidation to the Auth (register and login) endpoints and update READM _(run mpr0ir1c)_

- N/A — no new decisions requiring documentation.

## 2026-05-29 — Add Swagger/OpenAPI with XML comments, JWT security definitions, and basic endpo _(run mpr0n2g1)_

- [Decision: Swagger/OpenAPI is added as Development-only tooling with JWT Bearer security definitions and XML comments; Production guard prevents exposure]

## 2026-05-29 — Add structured logging with correlation IDs (TraceId) across all endpoints and s _(run mpr0rm66)_

- [Decision: Use middleware-scoped `ILogger` for TraceId propagation] — chosen because it guarantees correlation ID on every log without repeating it in every call site or message template.

## 2026-05-29 — Add health checks (database + basic) and structured logging with correlation IDs _(run mpr0xatz)_

- [Decision: Health checks use the lightweight `AddDbContextCheck<T>` instead of a custom `IHealthCheck` implementation — rationale: reuses the already-registered `FlowForgeDbContext` with zero additional code.]
- [Decision: TraceId is stored both on `HttpContext.Items` and as an `Activity` tag so it is available to both ProblemDetails and distributed tracing exporters.]

## 2026-05-29 — Expand integration tests for auth flows and ensure good coverage for Project/Tas _(run mpr1413r)_

- N/A — no new architectural decisions recorded this run.

## 2026-05-29 — Add production-ready configuration (CORS, security headers, rate limit tuning, l _(run mpr18z6j)_

- [Decision: Production CORS origins are validated at startup and the app fails if the list is empty — ensures misconfiguration is impossible to miss in Production]

## 2026-05-29 — Finalize README.md with complete local setup instructions, environment variables _(run mpr1du8h)_

- [Decision: Rate limiting is applied to all route groups (including anonymous auth endpoints) via a single fixed-window policy to protect the entire surface]

## 2026-05-29 — Add Serilog structured logging configuration with console + file sinks and basic _(run mpr1hf1v)_

- [Decision: Serilog structured logging with console + file sinks and environment-specific levels was chosen over Microsoft.Extensions.Logging defaults to enable TraceId enrichment and compact JSON file output for production diagnostics]

## 2026-05-29 — Review and expand integration test coverage for key flows (auth, project, task)  _(run mpr1lt64)_

- [Decision: keep single global FixedWindow rate-limit policy for simplicity; document that test fixtures must account for setup requests]

## 2026-05-29 — Fix rate-limit test flakiness in ProjectCreateRateLimitTests and TaskCreateRateL _(run mpr21ait)_

- [Decision: composite rate-limit test fixtures with dual PermitLimit factories sharing one SQLite connection were chosen to eliminate setup traffic from the low-limit window while keeping auth tokens valid]

## 2026-05-29 — Update README.md and .env.example with clear production JWT secret and database  _(run mpr27qd1)_

- [Decision: N/A — no new architectural decisions recorded in this documentation-only run]

## 2026-05-29 — Perform a final review of the FlowForge .NET 10 solution for beta readiness and  _(run mpr2axf2)_

- [Decision: Global FixedWindow rate limiting accepted for beta simplicity; per-client partitioning required before multi-tenant scale]
- [Decision: EF must enforce composite unique indexes on (ProjectId, Name) for Tasks and (OwnerId, Name) for Projects to match InMemory behavior]

## 2026-05-29 — Implement partitioned rate limiting (by IP for anonymous, by user sub when authe _(run mpr2fqtl)_

- [Decision: Use partitioned fixed-window rate limiting keyed by `sub` (authenticated) or IP (anonymous) — chosen for per-client fairness without per-endpoint policy explosion]
- [Decision: Model Project–Task FK via alternate key on `ProjectId` + composite unique indexes — required to match existing in-memory uniqueness rules while using EF Core constraints]

## 2026-05-29 — Add EF Core foreign key and composite unique indexes for Project-Task relationsh _(run mpr30rdz)_

- [Decision: Project–Task relationship uses typed alternate key (ProjectId) + composite unique indexes on (OwnerId, Name) and (ProjectId, Name) — rationale: enforces business rules at the database level while keeping domain value objects intact.]

## 2026-05-29 — Perform a final review of the FlowForge .NET 10 solution for beta readiness and  _(run mpr3mddn)_

- [Decision: Partitioned rate limiting (JWT sub / IP) replaces global FixedWindow for per-user fairness under load]
- [Decision: Explicit `dotnet ef database update` required in Production; auto-migrate disabled]

## 2026-05-29 — Regenerate EF Core migration for SQL Server compatibility, add partitioned rate  _(run mpr3t1jj)_

- [Decision: `FlowForgeDbContextFactory` now defaults to SQL Server for design-time operations so migrations are always authored against the production provider.]

## 2026-05-29 — Perform a final review of the FlowForge .NET 10 solution for beta readiness and  _(run mpr7w2fq)_

- [Decision: Rate limiter must run immediately after authentication and before authorization to protect all routes uniformly]
- [Decision: Duplicate-name constraint violations must map to 409 Conflict rather than 500]

## 2026-05-29 — Fix P0 beta blockers: rate-limiter ordering, duplicate-name 409 handling, JWT se _(run mpr85lkv)_

- [Decision: JWT secret must be ≥32 characters with ≥8 distinct characters and must not be a known dev placeholder in Production; validated at startup via `JwtSecretValidator`]
- [Decision: Duplicate name violations (EF Core unique-index errors + in-memory collisions) now return RFC 7807 409 ProblemDetails via `DuplicateConstraintViolationMapper`]
