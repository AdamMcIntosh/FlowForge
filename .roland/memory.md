# Roland Project Memory

_Updated automatically after each run. Edit manually at any time._

## Architecture Decisions

- Used primary constructor injection (`class Foo(IBar bar)`) across all services and repositories for conciseness
- SQLite chosen as default dev provider; SQL Server remains production-only via `Database:Provider` + environment-specific appsettings.
- Automatic `MigrateAsync` is deliberately disabled in Production; explicit migration runs are required for SQL Server.
- Fixed-window rate limiter chosen as the single policy for all auth/CRUD endpoints.
- N/A (no new decisions)
- Centralized exception-to-ProblemDetails mapping lives in `GlobalExceptionHandler` (not per-endpoint).
- JWT 401/403 responses are overridden via `JwtBearerEvents` to guarantee ProblemDetails format.
- Validation failures return RFC 7807 ProblemDetails via the existing `ProblemDetailsResults.BadRequest` helper for consistency.
- [×2] N/A — no new architectural choices.
- Swagger UI is explicitly disabled in Production via `IsProduction()` guard in `UseFlowForgeSwagger`.
- TraceId is injected exclusively via `ILogger` scope from middleware; never duplicated in message templates.
- TraceId middleware must run before `UseExceptionHandler` so that `ProblemDetails` responses always carry the correlation ID.
- `/health` must be explicitly excluded from rate limiting so readiness/liveness probes remain available under load.
- N/A — no architectural changes this run.
- Production CORS policy is strict (only configured origins) and fails fast at startup if the list is empty.
- Security headers middleware is always applied; HSTS is Production-only and driven by `Hsts:*` config.
- ASP.NET Core configuration sources (appsettings + env vars) are the single source of truth; `.env` files are never auto-loaded.
- Serilog is enabled by default via `Serilog:Enabled` configuration key; tests can disable it to preserve custom `ILoggerProvider` instances.
- Single global `RateLimitPolicies.FixedWindow` policy continues to protect auth + CRUD endpoints.

## Coding Standards

- Request DTOs are validated with `IValidator<T>` injected into minimal API handlers; `ValidateAsync(..., cancellationToken)` + `ToProblemDetailsResult()` pattern is now the standard.
- Validators placed under `src/FlowForge.Api/Validation/` following existing folder convention.
- Shared reusable rules extracted to `NameValidationRules.cs`.
- Validators placed in `src/FlowForge.Api/Validation/` and named `*RequestValidator`.
- Shared rules live in `*ValidationRules.cs` as extension methods.
- Tests split by layer (unit validator tests + HTTP integration tests).
- Swagger operation metadata is attached via `.WithMetadata(new SwaggerOperationAttribute(...))` on minimal API routes.
- XML documentation comments are placed on DTO records and endpoint handler methods.
- Endpoints use non-static marker types (`AuthEndpointLogs`) for `ILogger<T>` because static classes cannot be generic arguments.
- Repositories emit `LogDebug`; services emit `LogInformation`/`LogWarning`.
- All new logging uses structured templates with named placeholders (`{UserId}`, `{TraceId}`); string interpolation in log messages is prohibited.
- Health checks are registered via a single `AddFlowForgeHealthChecks()` extension and mapped with `.DisableRateLimiting()`.
- All `*EndpointTests` classes are `public sealed`.
- Every test file begins with a two-line comment describing the `WebApplicationFactory` + SQLite in-memory setup.
- Tests use unique emails (`Guid.NewGuid()`) to prevent cross-test data leakage.
- Extension methods follow the `AddFlowForge*` / `UseFlowForge*` naming pattern established earlier.
- Environment-specific behavior uses `IWebHostEnvironment.IsProduction()` guards.
- All new endpoints use `RequireRateLimiting`, `IValidator<T>`, `CancellationToken`, and `ILogger<T>`.
- Logging configuration lives in `Logging/SerilogLoggingExtensions.cs` following the existing `Api/*Extensions.cs` pattern.
- Rate-limit test fixtures keep main factories at `PermitLimit=10000` and use separate low-limit factories.

## Past Mistakes

- Tests directly instantiate `InMemoryUserRepository` instead of resolving through DI; root cause: no service-provider test fixture exists yet
- Never rely on EF Core `EnsureCreated` in production paths (was already avoided).
- N/A (no new pitfalls encountered in this run).
- Never place `UseRateLimiter()` before authentication/authorization (would rate-limit anonymous probes incorrectly).
- Never rely on `existingNameKey != newNameKey` when the same object reference is stored in both collections; the name change is already reflected before the check runs.
- Never place `UseExceptionHandler()` after authentication middleware (would miss early 401/403 events).
- Never replace the shared `ProblemDetailsResults.BadRequest` helper with ad-hoc validation error construction.
- N/A — no pitfalls encountered in this narrow scope.
- [×2] N/A — no new pitfalls encountered.
- Never place `UseSwagger` / `UseSwaggerUI` before `UseExceptionHandler` (order in Program.cs was verified correct).
- Never place logging middleware after `UseExceptionHandler` — correlation ID would be missing on error paths.
- Never place `UseRateLimiter` before health-check mapping if the health endpoint must remain available during rate-limit exhaustion.
- [×2] Never place secrets in `appsettings.Production.json` (confirmed Jwt secret is omitted).
- Never disable Serilog globally in production configs; the `Enabled` flag must remain `true` by default.
- Never set `PermitLimit=2` on a global policy when setup calls also hit rate-limited endpoints.

## Preferences

- Repository and service methods consistently accept `CancellationToken` as the final parameter with `= default`
- Health endpoint deliberately excluded from rate limiting.
- Shared `NameValidationRules` class is preferred over duplicating required + max-length rules.
- N/A — no new preferences surfaced.
- N/A — no new preferences recorded.
- Swagger remains a Development / test-only surface; never enabled in Production.
- Swagger UI only in Development; disabled in Production.
- `CollectCoverage=false` by default so normal `dotnet test` remains fast.

## Project Gotchas

- `InMemoryUserRepository` enforces unique email constraints at the in-memory level to mirror EF Core/SQL Server behavior
- SQLite `:memory:` databases vanish unless the `SqliteConnection` is kept open for the lifetime of the `WebApplicationFactory`; the factory therefore stores the connection as a field and calls `_connection.Open()` in its constructor.
- In-memory SQLite requires `Data Source=:memory:` + explicit connection lifetime management in tests.
- The single pre-existing test failure in `InMemoryTaskRepositoryTests.UpdateAsync_WhenRenamingToDuplicateNameInProject_Throws` must not be mistaken for a migration regression.
- Test factories must override `RateLimiting:PermitLimit` to a high value to avoid flakiness.
- The in-memory name index uses a composite key of `projectId:value`; duplicate detection must always compare by `Id`, not by name key.
- `OnChallenge` must call `HandleResponse()` and check `HasStarted` to avoid double writes.
- N/A — no environment or tooling surprises.
- N/A — no new environment or tooling quirks.
- XML file path resolution uses `AppContext.BaseDirectory` + assembly name; file may not exist in certain publish profiles (already guarded).
- `IHttpContextAccessor` must be registered for `GetTraceId()` extension to work outside controllers.
- `Console` logger requires `IncludeScopes: true` in `appsettings.json` for TraceId to appear in dev output.
- Production CORS validation throws `InvalidOperationException` on empty origins list — intentional fail-fast.
- Health-check endpoint is explicitly excluded from rate limiting via `.DisableRateLimiting()`.
- `UseSerilog()` clears custom logger providers, which is why the TraceId test factory must set `Serilog:Enabled=false`.
- `RemoveEfCoreRegistrations` is `internal static` so rate-limit factories can reuse it.

## Proven Patterns

- Test doubles (`InMemoryUserRepository`) live in `Infrastructure` so both unit tests and future integration tests can share the same fake
- Co-locating a `*EndpointWebApplicationFactory : WebApplicationFactory<Program>` (with shared SQLite connection + `RemoveEfCoreRegistrations`) inside the same file as the test class enables fast, realistic HTTP integration tests that exercise the full DI pipeline, auth middleware, and real EF Core repositories.
- Splitting test-author by layer (endpoint factories vs. repository tests) allowed parallel execution.
- Splitting migration generation + verification into a dedicated executor task allowed clean parallel review.
- Centralizing policy names in a static class allows easy reuse across endpoint groups.
- Splitting the duplicate-name guard into an explicit `Id`-based lookup + dedicated index-removal helper produced a correct, testable fix in one small change.
- Splitting exception handling into a dedicated `Exceptions/` folder keeps endpoint files clean and testable.
- Injecting `IValidator<T>` directly into endpoint handler signatures keeps the pattern lightweight while still using DI.
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

## Anti-Patterns

- [×2] (none new this run)
- [Hard-coding provider in test fixtures] — root cause: previous LocalDB assumption; example: original `HealthEndpointTests` used SQL Server LocalDB.
- [Hard-coding permit/window values] — root cause: loses environment-specific tuning; example: original implementation used literals before switching to `IConfiguration`.
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

---

_Last updated: 2026-05-29 · run mpr1lt64 · Review and expand integration test coverage for key flows (a_
