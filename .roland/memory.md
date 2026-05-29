# Roland Project Memory

_Updated automatically after each run. Edit manually at any time._

## Architecture Decisions

- `/health` must be explicitly excluded from rate limiting so readiness/liveness probes remain available under load.
- N/A — no architectural changes this run.
- Production CORS policy is strict (only configured origins) and fails fast at startup if the list is empty.
- Security headers middleware is always applied; HSTS is Production-only and driven by `Hsts:*` config.
- ASP.NET Core configuration sources (appsettings + env vars) are the single source of truth; `.env` files are never auto-loaded.
- Serilog is enabled by default via `Serilog:Enabled` configuration key; tests can disable it to preserve custom `ILoggerProvider` instances.
- Single global `RateLimitPolicies.FixedWindow` policy continues to protect auth + CRUD endpoints.
- N/A (no architectural changes).
- None new (documentation only).
- Rate limiting remains a single global FixedWindow policy (simplicity trade-off accepted for beta).
- EF relationships and unique constraints were intentionally omitted in the initial migration (now flagged as P0).
- Partitioned rate limiting chosen over global limiter to give fair per-user/per-IP quotas.
- `ProjectId` modeled as alternate key (not primary) to support both surrogate `Id` and domain `ProjectId` while enabling typed FKs.
- N/A — no new decisions this run.
- Partitioned (JWT `sub` / IP) fixed-window rate limiting chosen over global for fairness.
- Primary-constructor repositories + per-call `SaveChangesAsync` (no Unit of Work) accepted for current scope.
- Design-time `DbContextFactory` now defaults to SQL Server (production source of truth) while still supporting SQLite via environment variable.
- Single-instance partitioned fixed-window rate limiting accepted for beta.
- Dual-ID + alternate-key pattern retained for domain value objects.
- SQLite dev / SQL Server prod with one migration strategy confirmed.

## Coding Standards

- Health checks are registered via a single `AddFlowForgeHealthChecks()` extension and mapped with `.DisableRateLimiting()`.
- All `*EndpointTests` classes are `public sealed`.
- Every test file begins with a two-line comment describing the `WebApplicationFactory` + SQLite in-memory setup.
- Tests use unique emails (`Guid.NewGuid()`) to prevent cross-test data leakage.
- Extension methods follow the `AddFlowForge*` / `UseFlowForge*` naming pattern established earlier.
- Environment-specific behavior uses `IWebHostEnvironment.IsProduction()` guards.
- All new endpoints use `RequireRateLimiting`, `IValidator<T>`, `CancellationToken`, and `ILogger<T>`.
- Logging configuration lives in `Logging/SerilogLoggingExtensions.cs` following the existing `Api/*Extensions.cs` pattern.
- Rate-limit test fixtures keep main factories at `PermitLimit=10000` and use separate low-limit factories.
- Rate-limit test fixtures must use a high-limit “setup” factory for registration / prerequisite creates and a low-limit factory exclusively for the assertions under test; both factories share one open SQLite connection.
- None new.
- All endpoints use primary-constructor minimal APIs and FluentValidation.
- ProblemDetails + traceId on every error response (including 429).
- Rate-limit resolver placed in `RateLimiting` folder alongside policy constants.
- All EF configurations use explicit `HasAlternateKey` + `HasIndex(...).IsUnique()` for composite uniqueness.
- Entity configurations continue to use `HasAlternateKey` + `HasPrincipalKey` for typed IDs and `HasIndex(...).IsUnique()` for composite uniqueness.
- Value objects, primary constructors, `AsNoTracking` on list reads, and RFC 7807 ProblemDetails remain the enforced patterns.
- Rate-limiting configuration uses a typed options class bound from `RateLimiting` section with safe fallback behavior.
- Password policy rules are implemented as chained FluentValidation extensions with `[GeneratedRegex]` partial methods (consistent with existing email validation).
- Primary constructors, immutable value objects, and repository interfaces per existing project conventions.

## Past Mistakes

- Never replace the shared `ProblemDetailsResults.BadRequest` helper with ad-hoc validation error construction.
- N/A — no pitfalls encountered in this narrow scope.
- [×3] N/A — no new pitfalls encountered.
- Never place `UseSwagger` / `UseSwaggerUI` before `UseExceptionHandler` (order in Program.cs was verified correct).
- Never place logging middleware after `UseExceptionHandler` — correlation ID would be missing on error paths.
- Never place `UseRateLimiter` before health-check mapping if the health endpoint must remain available during rate-limit exhaustion.
- [×2] Never place secrets in `appsettings.Production.json` (confirmed Jwt secret is omitted).
- Never disable Serilog globally in production configs; the `Enabled` flag must remain `true` by default.
- Never set `PermitLimit=2` on a global policy when setup calls also hit rate-limited endpoints.
- Never reuse a single low-PermitLimit factory for both setup and rate-limit assertions — setup calls consume permits and cause the third create to hit 429 on the second attempt instead of the third.
- None encountered in this run.
- Never rely on InMemory uniqueness behavior to protect production DB (root cause: EF indexes were non-unique while repositories enforced uniqueness).
- Never leave two `InitialCreate` migrations in the same folder — causes model snapshot conflicts.
- Do not rely on SQLite `ALTER TABLE` for complex constraint changes; always regenerate initial migration in dev.
- Never generate EF Core migrations against only SQLite when SQL Server is a documented production target.
- Never leave `ARCHITECTURE.MD` stale after feature completion.
- Never leave an old SQLite migration in place when regenerating for SQL Server — type mappings differ and cause `PendingModelChangesWarning` on the other provider.
- Never register `UseRateLimiter()` after `UseAuthorization()` — protected routes bypass limits on 401.
- Never leave production config files with real or plausible connection-string placeholders.
- Failing to handle `DbUpdateException` for unique-constraint violations on project/task names (root cause: no global or per-handler mapping of EF constraint errors to 409; example: create endpoints return 500 instead of 409 ProblemDetails)

## Preferences

- Repository and service methods consistently accept `CancellationToken` as the final parameter with `= default`
- Health endpoint deliberately excluded from rate limiting.
- Shared `NameValidationRules` class is preferred over duplicating required + max-length rules.
- [×2] N/A — no new preferences surfaced.
- N/A — no new preferences recorded.
- Swagger remains a Development / test-only surface; never enabled in Production.
- Swagger UI only in Development; disabled in Production.
- `CollectCoverage=false` by default so normal `dotnet test` remains fast.
- None surfaced.
- Production connection strings must use SQL auth + `Encrypt=True` (avoid Windows `Trusted_Connection`).
- Prefer `JwtRegisteredClaimNames.Sub` first, then `ClaimTypes.NameIdentifier` for authenticated partition keys.
- Prefer explicit `dotnet ef database update` in Production over auto-migrate.
- Prefer explicit fail-fast at startup for secrets and required configuration.
- JWT secret minimum length/entropy must be validated at startup with explicit fail-fast (not just presence)

## Project Gotchas

- `OnChallenge` must call `HandleResponse()` and check `HasStarted` to avoid double writes.
- N/A — no environment or tooling surprises.
- [×2] N/A — no new environment or tooling quirks.
- XML file path resolution uses `AppContext.BaseDirectory` + assembly name; file may not exist in certain publish profiles (already guarded).
- `IHttpContextAccessor` must be registered for `GetTraceId()` extension to work outside controllers.
- `Console` logger requires `IncludeScopes: true` in `appsettings.json` for TraceId to appear in dev output.
- Production CORS validation throws `InvalidOperationException` on empty origins list — intentional fail-fast.
- Health-check endpoint is explicitly excluded from rate limiting via `.DisableRateLimiting()`.
- `UseSerilog()` clears custom logger providers, which is why the TraceId test factory must set `Serilog:Enabled=false`.
- `RemoveEfCoreRegistrations` is `internal static` so rate-limit factories can reuse it.
- Rate-limit counters are per `WebApplicationFactory` instance; separate factories are required to isolate permit windows even when the database is shared.
- None new.
- Relative `logs/` path for Serilog file sink will fail in read-only containers.
- Old migration `20260529140041` must be dropped before applying the new `20260529152309` on fresh SQLite databases.
- `FlowForgeDbContextFactory` is SQLite-only; design-time tooling limits multi-provider migration authoring.
- `InMemoryProjectRepository` global uniqueness differs from EF `(OwnerId, Name)` composite.
- Existing SQLite `flowforge.db` files created with the prior migration must be deleted after applying the new `20260529155708_InitialCreate`.
- `InMemoryProjectRepository` still uses global name uniqueness while EF uses `(OwnerId, Name)`.
- `EnsureCreated()` in tests never validates the real migration schema.
- `DbUpdateException` from unique constraints surfaces as 500 unless explicitly caught and mapped to RFC 7807 409

## Proven Patterns

- Splitting validation tests by layer (unit + HTTP integration) allowed focused coverage with minimal overlap.
- Reusing `AddValidatorsFromAssemblyContaining<CreateProjectRequestValidator>()` automatically registers new validators without DI changes.
- Splitting validator unit tests and HTTP integration tests allowed parallel work.
- Splitting test-authoring by layer (endpoint tests vs. validator tests) allowed parallel execution.
- Splitting middleware setup (`Add*`/`Use*`) from handler logic allowed clean parallel work between the two tasks.
- Splitting test authoring by layer (endpoint vs. logging scope) allowed parallel verification of middleware and health endpoints.
- Splitting test-author by layer (Auth / Project / Task) allowed parallel execution with test-executor.
- Splitting configuration, middleware, and tests into dedicated folders (`Cors/`, `Security/`, `ProductionConfigEndpointTests.cs`) kept the change focused and testable.
- Splitting test authorship by layer (endpoint vs service vs validator) allowed parallel execution with zero conflicts.
- Splitting the Serilog registration into a reusable extension method allowed clean conditional enabling without polluting `Program.cs`.
- Splitting test-author by layer allowed parallel execution of coverage expansion and test execution.
- Composite fixture with two factories sharing one `SqliteConnection` cleanly separates setup traffic from the rate-limit window while preserving JWT validity.
- None new.
- Splitting test-author responsibility by layer (endpoint vs repository) allowed parallel execution with zero conflicts.
- Splitting work into isolated tasks (rate-limiting vs EF) allowed parallel execution with clean handoff via blackboard.
- N/A — verification run only.
- Splitting reviews by security / architecture / performance allowed three agents to run in parallel with no overlap.
- Splitting work by layer (migration, rate-limiting middleware, validation rules) allowed three agents to execute in parallel with zero merge conflicts.
- Three parallel specialized engineer reviews (architect, security, code) produced consistent P0 findings.
- Running three parallel specialized reviewers (architect/security/code) on the same codebase surfaces identical P0 release blockers with zero overlap in findings

## Anti-Patterns

- [Comparing old vs new name keys on the same entity reference] — root cause: in-memory objects are mutated before `UpdateAsync` is called; example: the `Rename` + `UpdateAsync` sequence in the failing test.
- [Returning raw exception messages or stack traces] — root cause: missing global handler or per-handler try/catch that re-throws; example: pre-task auth endpoints.
- [Inline string.IsNullOrWhiteSpace checks in handlers] — root cause: validator not yet wired; example: pre-existing checks removed from Project/Task create/update handlers.
- N/A — no anti-patterns observed.
- N/A — no anti-patterns introduced.
- [Adding Swagger without a Production guard] — root cause: accidental information disclosure; example: previous projects that exposed full API surface in prod.
- [Interpolating TraceId into log message templates] — root cause: defeats structured logging and scope benefits; example: avoided in `GlobalExceptionHandler`.
- [Placing health-check mapping inside a rate-limited route group] — root cause: global `UseRateLimiter()` applies to all subsequent mappings; example: original `/health` placement would have been blocked.
- [Placing secrets in appsettings.Production.json] — root cause: easy to commit; example: avoided by requiring `Jwt__Secret` env var only.
- [Hardcoding connection strings or JWT secrets] — root cause: violates 12-factor and startup validation; example: earlier dev versions had fallback secrets in appsettings.
- [Hard-coding log levels or sink paths] — root cause: violates 12-factor config; example: previous manual `WriteTo.Console()` calls in code.
- [global rate-limit fixture with insufficient permits] — root cause: single policy counter shared across register + CRUD; example: `ProjectCreateRateLimitTests` and `TaskCreateRateLimitTests`.
- [Single-factory rate-limit tests] — root cause: all HTTP calls share the same permit counter; example: original `ProjectCreateRateLimitTests` and `TaskCreateRateLimitTests`.
- None new.
- [Copy-paste of `TryGetOwnerId` helper] — root cause: duplicated in two endpoint files; example: `ProjectEndpoints.cs` and `TaskEndpoints.cs`.
- [Squashing migrations in a shared repo without documenting prod impact] — root cause: desire for clean SQLite history; example: previous `InitialCreate` left dangling in git.
- N/A — no new anti-patterns identified.
- [Committing provider-specific migration snapshots without CI verification] — root cause: design-time factory locked to SQLite; example: `InitialCreate` `TEXT` columns.
- [Placing `UseForwardedHeaders` after other middleware] — root cause: `RemoteIpAddress` would already be resolved; example: rate-limiter partition key would capture the proxy IP instead of the real client.
- [Copy-paste `TryGetOwnerId`] — root cause: no shared `ClaimsPrincipalExtensions`; example: duplicated in `ProjectEndpoints.cs` and `TaskEndpoints.cs`.

---

_Last updated: 2026-05-29 · run mpr7w2fq · Perform a final review of the FlowForge .NET 10 solution for_
