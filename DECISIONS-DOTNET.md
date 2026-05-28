# FlowForge .NET Architecture Decisions (ADRs)

This file records technology and architecture decisions for the **Node.js → .NET 10** rewrite. Decisions inherit principles from [DECISIONS.md](DECISIONS.md) and layer mapping from [ARCHITECTURE-DOTNET.md](ARCHITECTURE-DOTNET.md). The Node.js codebase is the behavioral reference; this port preserves API contracts, authorization rules, and Clean Architecture boundaries unless explicitly superseded below.

**Related artifacts:** migration inventory (blackboard / explore agent), `ARCHITECTURE-DOTNET.md`, canonical Node ADRs in `DECISIONS.md`.

---

## Decision Log

### 2025-05-28: Target Runtime — .NET 10 LTS

**Status:** Accepted  
**Context:** FlowForge is being rewritten from Node.js 20 + TypeScript to a long-lived backend. The team goal specifies .NET 10.  
**Decision:** Target **.NET 10** (`net10.0`) for all projects in the solution. Pin SDK via `global.json` (e.g. `10.0.8` or latest patch). Use **C# 14** language features where they reduce boilerplate (primary constructors, collection expressions) without sacrificing readability.

| Aspect | Choice |
|--------|--------|
| Release type | LTS (support through November 2028) |
| SDK | .NET 10 SDK only — EF Core 10 and ASP.NET Core 10 do not run on earlier runtimes |
| Nullable | `<Nullable>enable</Nullable>` on all projects |
| Implicit usings | Enabled for Application, Infrastructure, Api; **disabled** for Domain |
| Analysis | `<AnalysisLevel>latest</AnalysisLevel>`, treat warnings as errors in CI |

**Rationale:** LTS aligns with enterprise deployment expectations. .NET 10 ships ASP.NET Core 10 and EF Core 10 as co-versioned, supported stack components. Staying on the current LTS avoids repeating the Node project's drift across major versions.

**Consequences:** CI agents and developer machines require .NET 10 SDK. Docker base images use `mcr.microsoft.com/dotnet/aspnet:10.0`. No `net8.0` / `net9.0` multi-targeting unless a downstream dependency forces it (not expected).

**Node parity:** Replaces Node `>=20` engine constraint and ESM/TypeScript toolchain.

---

### 2025-05-28: Solution Structure — Clean Architecture (Four Projects)

**Status:** Accepted  
**Context:** The Node app uses Domain → Application → Adapters → Infrastructure. The .NET architect mapping consolidates Adapters into the Api layer.  
**Decision:** Single solution `FlowForge.sln` with four projects:

| Project | Node.js equivalent | References |
|---------|-------------------|------------|
| `FlowForge.Domain` | `src/domain/` | None |
| `FlowForge.Application` | `src/application/` | Domain |
| `FlowForge.Infrastructure` | `src/infrastructure/` + Prisma repos | Application, Domain |
| `FlowForge.Api` | `src/adapters/` + `src/routes/` + `server.ts` | Application, Infrastructure |

Test projects (added in later waves):

| Project | Scope |
|---------|-------|
| `FlowForge.Domain.Tests` | Domain unit tests |
| `FlowForge.Application.Tests` | Use-case unit tests (in-memory fakes) |
| `FlowForge.Infrastructure.Tests` | Repository unit tests (mocked `DbContext` or in-memory) |
| `FlowForge.Api.Tests` | HTTP integration tests (`WebApplicationFactory` + Testcontainers) |

**Dependency rule:** Domain has zero framework references. Application defines repository **interfaces** (`IUserRepository`, `IRefreshTokenRepository`, `IProjectRepository`, `ITaskRepository`) and service abstractions (`IJwtService`, `IPasswordHasher`, `IRateLimiter`). Infrastructure implements them. Api is the composition root only.

**Rationale:** Corrects the Node pattern where repository interfaces live in `src/infrastructure/*/types.ts` — interfaces belong in Application so use cases depend inward on abstractions, not on Infrastructure. Matches textbook Clean Architecture and simplifies test doubles.

**Consequences:** Executors must not reference EF Core, JWT libraries, or ASP.NET types from Domain or Application. `Program.cs` calls `AddApplication()` and `AddInfrastructure(configuration)`.

**Node parity:** Same layer responsibilities; improved interface placement vs Node.

---

### 2025-05-28: Database — SQL Server with EF Core 10

**Status:** Accepted  
**Context:** Node uses PostgreSQL + Prisma. Team goal specifies SQL Server + EF Core. Schema is small (User, Project, Task, RefreshToken).  
**Decision:**

| Aspect | Choice |
|--------|--------|
| ORM | **Entity Framework Core 10** (`Microsoft.EntityFrameworkCore.SqlServer` 10.0.x) |
| Database | **Microsoft SQL Server** |
| Dev / CI default image | `mcr.microsoft.com/mssql/server:2022-CU14-ubuntu-22.04` |
| Production target | SQL Server 2022 or Azure SQL (compatible) |
| Modeling | Code-first; `AppDbContext` in `FlowForge.Infrastructure/Persistence/` |
| Migrations | EF Core migrations checked into `Infrastructure/Persistence/Migrations/` |
| IDs | `uniqueidentifier` (GUID) stored as string in API responses for client compatibility |
| Timestamps | `datetimeoffset` with UTC; set in domain/application, not DB triggers |
| Task status | Enum mapped to SQL `nvarchar` or native enum column; values `TODO`, `IN_PROGRESS`, `DONE` |
| Soft delete | **Not used** — hard delete with cascade (matches Prisma `onDelete`) |

**SQL Server 2025:** Deferred. EF Core 10 supports JSON and vector types on SQL Server 2025, but Testcontainers support for 2022 is more mature. Revisit when production requires JSON columns or 2025-specific features.

**Rationale:** Team mandate. EF Core is the first-class .NET ORM with strong LINQ, migrations, and SQL Server integration. SQL Server matches common enterprise hosting and differentiates the rewrite from the Node PostgreSQL stack while keeping the same relational model.

**Consequences:** Local dev requires Docker (SQL Server container) or LocalDB on Windows. `docker-compose.yml` will expose SQL Server instead of Postgres. Connection string via `ConnectionStrings:Default` in configuration. No Prisma, no SQLite in production path.

**Node parity:** Replaces `prisma/schema.prisma` and `@prisma/client`. Repository method signatures mirror Node `TaskRepository`, `ProjectRepository`, `UserRepository`.

---

### 2025-05-28: Repository Pattern — EF Core Behind Application Interfaces

**Status:** Accepted  
**Context:** Node implements `createPrismaTaskRepository()` and `createInMemoryTaskRepository()` against interfaces in infrastructure. Tests rely heavily on in-memory fakes.  
**Decision:** Preserve the repository pattern with two implementations per aggregate where needed:

| Interface (Application) | Production (Infrastructure) | Tests |
|-------------------------|----------------------------|-------|
| `IUserRepository` | `EfUserRepository` | `InMemoryUserRepository` |
| `IRefreshTokenRepository` | `EfRefreshTokenRepository` | `InMemoryRefreshTokenRepository` |
| `IProjectRepository` | `EfProjectRepository` | `InMemoryProjectRepository` |
| `ITaskRepository` | `EfTaskRepository` | `InMemoryTaskRepository` |

Mapping uses domain factory methods (`User.Create`, `Task.Reconstitute`, etc.) — **never** expose EF entities outside Infrastructure.

**Rationale:** Proven in Node; enables fast unit tests without Docker and integration tests with real SQL. Keeps domain free of persistence attributes.

**Consequences:** Each repository method maps 1:1 to Node (`save`, `findById`, `findByProjectId`, `update`, `delete`). EF `SaveChangesAsync` is called inside repository methods, not in use cases.

**Node parity:** Direct port of repository contracts from `src/infrastructure/*/types.ts`.

---

### 2025-05-28: Refresh Token Persistence — SQL Server (Close MVP Debt)

**Status:** Accepted  
**Context:** Node ADR `2025-05-27: In-Memory Refresh Token Repository (MVP)` stores refresh rotation state in memory. This breaks multi-instance deployment and loses state on restart.  
**Decision:** Persist refresh tokens in SQL Server from the first .NET auth implementation.

**`RefreshToken` table (minimum columns):**

| Column | Purpose |
|--------|---------|
| `Jti` (PK) | Unique token id |
| `UserId` | Owner |
| `Family` | Rotation family UUID |
| `Status` | `active` \| `rotated` \| `revoked` |
| `ExpiresAt` | TTL enforcement |
| `CreatedAt` | Audit |

Family-wide revocation sets all matching rows to `revoked` or uses a separate `RevokedFamilies` table — match Node `revokeFamily` / `isFamilyRevoked` semantics.

**Rationale:** .NET rewrite is greenfield; no need to carry interim in-memory auth state into production. Aligns with `2025-05-27: Refresh Token Rotation with Family Replay Detection`.

**Consequences:** Auth integration tests that need refresh rotation use either Testcontainers SQL Server or `InMemoryRefreshTokenRepository` in unit tests. HTTP integration tests for refresh/logout should use the in-memory fake unless explicitly testing EF persistence.

**Node parity:** Supersedes Node in-memory interim ADR for the .NET stack only.

---

### 2025-05-28: Authentication — Custom JWT (RS256), Not ASP.NET Identity

**Status:** Accepted  
**Context:** Node uses custom JWT service (`jsonwebtoken`, RS256 PEM keys, typed claims, unique `jti`, refresh families). ASP.NET Identity is an alternative but adds opinionated user store, cookie flows, and different token shape.  
**Decision:** **Do not use ASP.NET Identity** for the MVP port. Implement custom auth matching Node behavior:

| Component | Package / approach |
|-----------|-------------------|
| JWT signing / verification | `System.IdentityModel.Tokens.Jwt` + `Microsoft.IdentityModel.Tokens` |
| Bearer validation | `Microsoft.AspNetCore.Authentication.JwtBearer` with `TokenValidationParameters` (RS256, issuer/audience optional or configured) |
| Password hashing | **Argon2id** via `Konscious.Security.Cryptography.Argon2` (match Node `argon2` package) |
| Claims | Same as Node: access (`sub`, `email`, `jti`, `type: "access"`); refresh (`sub`, `jti`, `family`, `type: "refresh"`) |
| Key material | PEM in config: `Jwt:PrivateKey`, `Jwt:PublicKey` (support `\n` normalization like Node `config.ts`) |
| TTL defaults | Access 900 s; refresh 604 800 s (7 days) — configurable |

**Endpoints (unchanged):** `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`. Protected routes use `[Authorize]` + custom claims principal; `userId` from `sub` claim only.

**Rationale:** Preserves API contracts and security ADRs (no enumeration, rotation, replay detection). Avoids Identity schema migration and UI/password-reset features not in scope. `JwtBearer` middleware integrates cleanly with ASP.NET Core authorization.

**Consequences:** Custom `IJwtService` in Application, implementation in Infrastructure. Executors wire `AddAuthentication().AddJwtBearer(...)` in `Program.cs`. Token issuance stays in application use cases, not in middleware.

**Node parity:** Direct port of `jwt-service.ts`, `password-hasher.ts`, and auth use cases.

---

### 2025-05-28: Input Validation — FluentValidation

**Status:** Accepted  
**Context:** Node uses Zod at application DTO and HTTP adapter boundaries. .NET needs an equivalent with strong typing and composable rules.  
**Decision:** Use **FluentValidation** (11.x) for all request validation.

| Layer | Pattern |
|-------|---------|
| Application | Validators for use-case inputs (`RegisterCommand`, `CreateTaskCommand`, etc.) |
| Api | Validators for HTTP request models; controllers accept records/DTOs |
| Registration | `AddValidatorsFromAssemblyContaining<>` in Application DI |

Validation errors map to HTTP **400** with shape compatible with Node:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "...",
  "code": "VALIDATION_ERROR"
}
```

Use `IExceptionHandler` or middleware to normalize Problem Details into the existing `{ statusCode, error, message, code? }` contract so clients and ported integration tests stay stable.

**Rationale:** FluentValidation is the de facto .NET standard, supports async rules, and keeps validation out of domain entities (same as Zod + domain invariants in Node).

**Consequences:** No DataAnnotations on domain types. Password rules (letter + number, min length) live in FluentValidation + domain `Password` value object.

**Node parity:** Replaces Zod schemas in `src/application/*/dto/` and `src/adapters/*/map-*-request.ts`.

---

### 2025-05-28: Rate Limiting — ASP.NET Core Rate Limiter + Auth-Specific Keys

**Status:** Accepted  
**Context:** Node uses a custom fixed-window limiter with early `/auth/*` hook (before body parse) and per-IP + per-email keys on register/login. Defaults: 10 requests / 60 s.  
**Decision:**

| Layer | Implementation |
|-------|----------------|
| Global / auth routes | Built-in **`Microsoft.AspNetCore.RateLimiting`** (.NET 7+) with fixed-window policy |
| Auth early rejection | Middleware registered **before** model binding on `/auth/*` paths; partition by client IP (`PartitionResolver`) |
| Register / login | Additional partition keys on normalized email after validation |
| Response | **429** with `Retry-After` header |
| Defaults | 10 requests per 60 seconds (`RateLimit:WindowSeconds`, `RateLimit:PermitLimit`) |
| Task / project routes | **Not rate-limited** in MVP (matches Node ADR) |

Store: in-memory (`MemoryRateLimiter`) for single-instance MVP; document Redis-backed replacement for horizontal scale (same consequence as Node in-process store).

**Rationale:** Built-in rate limiting is maintained by the platform, avoids third-party drift, and supports partition keys analogous to Node's `ip:` and `user:` keys.

**Consequences:** Integration tests must use **fresh rate-limiter options per test class** or disable rate limiting via test `WebApplicationFactory` configuration to prevent cross-test leakage (Node tests already isolate limiter instances).

**Node parity:** Replaces `src/infrastructure/auth/rate-limiter.ts` and `registerEarlyRateLimit`.

---

### 2025-05-28: API Host — ASP.NET Core Minimal Hosting with Controllers

**Status:** Accepted  
**Context:** Node uses Fastify with plugin-based routes. Team goal specifies ASP.NET Core.  
**Decision:**

| Aspect | Choice |
|--------|--------|
| Hosting | Minimal hosting model (`WebApplication.CreateBuilder`) |
| Endpoints | **Attribute-routed Controllers** (`[ApiController]`) — not Minimal APIs for MVP |
| Serialization | System.Text.Json; camelCase property names |
| Health | `GET /health` → `{ "status": "ok" }` (match Node) |
| Errors | Global exception handler producing Node-compatible JSON error bodies |
| CORS | Default policy from configuration; permissive in Development only |
| HTTPS | Enforced in Production; optional in Development |

**Controller layout:**

| Controller | Routes |
|------------|--------|
| `AuthController` | `/auth/*` |
| `MeController` | `GET /me` |
| `ProjectsController` | `/projects`, `/projects/{id}` |
| `TasksController` | `/projects/{projectId}/tasks`, `/tasks/{id}` |

**Rationale:** Controllers map cleanly from Node `src/adapters/*` + `src/routes/*`. Minimal hosting keeps `Program.cs` as the composition root equivalent of `buildServer()`. Minimal APIs can be adopted later for new endpoints if desired.

**Consequences:** `Microsoft.AspNetCore.Mvc.Testing` for integration tests. Route names and HTTP verbs must match Node for client compatibility.

**Node parity:** Replaces Fastify server and route plugins.

---

### 2025-05-28: Authorization — Project-Owner Task Access (Preserved)

**Status:** Accepted  
**Context:** Node ADRs define project-owner-only task authorization via `task-access.ts`; assignees have no API access in MVP.  
**Decision:** Port authorization **unchanged**:

- `TaskAccessService` (or static helpers) in Application with `RequireOwnedProjectAsync` and `RequireTaskAccessibleByProjectOwnerAsync`.
- `userId` from JWT `sub` only — never from request body.
- HTTP status mapping: `403` (`TASK_UNAUTHORIZED`), `404` (`TASK_NOT_FOUND`) for cross-owner isolation.

**Rationale:** Authorization is core product behavior documented in multiple Node ADRs; not a technology choice but a hard requirement for the rewrite.

**Consequences:** Same test matrix as Node: owner allowed, non-owner denied, assignee-without-ownership denied.

**Node parity:** Port of `src/application/task/task-access.ts`.

---

### 2025-05-28: Testing Strategy — xUnit + In-Memory Fakes + Testcontainers

**Status:** Accepted  
**Context:** Node uses Vitest with in-memory repositories for unit/HTTP tests and SQLite Prisma for repository integration tests. Team goal specifies xUnit + Testcontainers.  
**Decision:** Three-tier test strategy:

#### Tier 1 — Unit tests (fast, no Docker)

| Target | Framework | Doubles |
|--------|-----------|---------|
| Domain | xUnit + FluentAssertions | None |
| Application use cases | xUnit + FluentAssertions | In-memory repositories |
| Infrastructure repos | xUnit | Mock `AppDbContext` / in-memory EF (`UseInMemoryDatabase` **only** for repo unit tests, not HTTP integration) |
| JWT / rate limiter | xUnit | Real implementation with test keys |

**Packages:** `xunit` 2.9.x, `xunit.runner.visualstudio`, `FluentAssertions` 7.x, `Moq` 4.20.x (or NSubstitute 5.x — pick one per solution, default **Moq**).

#### Tier 2 — API integration tests (in-memory persistence)

| Target | Setup |
|--------|-------|
| Auth, projects, tasks HTTP | `WebApplicationFactory<Program>` with DI overrides: in-memory repositories + in-memory refresh tokens |
| Assertions | `HttpClient` against test server; assert status codes and JSON bodies match Node contracts |

**Rationale:** Matches Node's `createAuthTestApp()` / `createTaskIntegrationTestApp()` pattern — full HTTP path without database.

#### Tier 3 — Integration tests (real SQL Server via Testcontainers)

| Target | Setup |
|--------|-------|
| EF repositories, migrations | `Testcontainers.MsSql` 4.x + `IAsyncLifetime` fixture |
| Factory | Shared `MsSqlContainer` per test **class** (`IClassFixture<>`) |
| Schema | `await dbContext.Database.MigrateAsync()` once per fixture |
| Isolation | Transaction rollback per test **or** truncate tables in `DisposeAsync` |

**Packages:** `Microsoft.AspNetCore.Mvc.Testing`, `Testcontainers.MsSql`, `Microsoft.EntityFrameworkCore.SqlServer`, `coverlet.collector`.

**Coverage:** `coverlet` with minimum thresholds enforced in CI once baseline established (target ≥ 80% line coverage on Application + Domain, matching team goal intent).

**Rationale:** Testcontainers provides real SQL Server behavior (constraints, cascades, types) unlike EF InMemory provider. In-memory fakes keep the bulk of tests fast and deterministic — proven in Node (233+ task tests without Postgres).

**Consequences:** Tier 3 tests require Docker locally and in CI. Tier 1–2 run without Docker. Do not use EF InMemory provider for HTTP integration tests.

**Node parity:** Vitest → xUnit; SQLite Prisma tests → Testcontainers SQL Server; in-memory repo tests → preserved.

---

### 2025-05-28: CI/CD — GitHub Actions with Split Jobs

**Status:** Accepted  
**Context:** No CI workflow exists in the Node repo yet. The .NET rewrite should establish pipeline conventions from day one.  
**Decision:** GitHub Actions workflow `.github/workflows/dotnet.yml`:

```yaml
# Conceptual structure — executor implements exact YAML
jobs:
  build:
    - checkout
    - setup-dotnet (10.0.x)
    - dotnet restore
    - dotnet build --no-restore -c Release

  unit-tests:
    needs: build
    - dotnet test --no-build -c Release
        --filter "Category!=Integration"
        --collect:"XPlat Code Coverage"

  integration-tests:
    needs: build
    services: []  # Testcontainers manages SQL Server
    - Docker available on ubuntu-latest
    - dotnet test --no-build -c Release
        --filter "Category=Integration"
```

| Concern | Choice |
|---------|--------|
| Platform | `ubuntu-latest` primary; optional `windows-latest` smoke job |
| Docker | Required for integration job (Testcontainers) |
| Formatting | `dotnet format --verify-no-changes` in build job |
| Artifacts | Test results TRX, coverage Cobertura → optional Codecov |
| Database migrations | Verify `dotnet ef migrations has-pending-model-changes` in CI |
| Secrets | JWT keys via GitHub Actions secrets / test PEM files in repo for CI only |
| Node coexistence | During transition, Node and .NET workflows can coexist; .NET workflow triggers on `src/**/*.cs` and `**/*.csproj` paths |

**Rationale:** Split jobs keep PR feedback fast (unit tests ~seconds) while still validating EF + SQL Server on merge. Testcontainers on GitHub Actions ubuntu runners is standard practice.

**Consequences:** Contributors need Docker Desktop (or compatible engine) for full test suite. Document in README.

**Node parity:** Replaces `npm test` / Vitest with `dotnet test`; adds formal CI where Node had none.

---

### 2025-05-28: Configuration — Options Pattern with Validation

**Status:** Accepted  
**Context:** Node uses Zod-validated `getEnv()` for `DATABASE_URL`, JWT keys, rate limits, and port.  
**Decision:** Use **`IOptions<T>`** with **DataAnnotations validation** or **`IValidateOptions<T>`** at startup:

| Section | Keys |
|---------|------|
| `ConnectionStrings:Default` | SQL Server connection |
| `Jwt:PrivateKey`, `Jwt:PublicKey` | PEM strings |
| `Jwt:AccessTokenTtlSeconds` | Default 900 |
| `Jwt:RefreshTokenTtlSeconds` | Default 604800 |
| `RateLimit:WindowSeconds` | Default 60 |
| `RateLimit:PermitLimit` | Default 10 |

Fail fast on invalid configuration (`ValidateOnStart()`). Support `.env` / user-secrets in Development via `dotnet user-secrets` or optional `.env` loader — not required for CI.

**Rationale:** Idiomatic ASP.NET Core; equivalent to Node Zod schema validation.

**Consequences:** No direct `Environment.GetEnvironmentVariable` in use cases.

**Node parity:** Replaces `src/infrastructure/config.ts`.

---

## Technology Stack Summary

| Area | Decision | Primary packages |
|------|----------|------------------|
| Runtime | .NET 10 LTS | `net10.0` |
| Web | ASP.NET Core 10 | `Microsoft.AspNetCore.App` (framework ref) |
| ORM | EF Core 10 | `Microsoft.EntityFrameworkCore.SqlServer` 10.0.x |
| Database | SQL Server 2022+ | Docker / Azure SQL |
| Auth | Custom JWT RS256 | `Microsoft.AspNetCore.Authentication.JwtBearer`, `System.IdentityModel.Tokens.Jwt` |
| Passwords | Argon2id | `Konscious.Security.Cryptography.Argon2` |
| Validation | FluentValidation | `FluentValidation`, `FluentValidation.DependencyInjectionExtensions` |
| Rate limit | Built-in | `Microsoft.AspNetCore.RateLimiting` |
| Unit tests | xUnit | `xunit`, `FluentAssertions`, `Moq` |
| Integration tests | Testcontainers | `Testcontainers.MsSql`, `Microsoft.AspNetCore.Mvc.Testing` |
| Coverage | Coverlet | `coverlet.collector` |
| CI | GitHub Actions | `actions/setup-dotnet@v4`, Docker |

---

## Node.js → .NET Decision Mapping

| Node ADR / pattern | .NET decision |
|--------------------|---------------|
| PostgreSQL + Prisma | SQL Server + EF Core 10 |
| Zod validation | FluentValidation |
| Fastify + plugins | ASP.NET Core Controllers |
| `jsonwebtoken` RS256 | `System.IdentityModel.Tokens.Jwt` + JwtBearer |
| `argon2` | Konscious Argon2id |
| In-memory refresh tokens (MVP) | **SQL Server persistence** (superseded for .NET) |
| Custom fixed-window rate limiter | ASP.NET Core Rate Limiting middleware |
| Repository interfaces in infrastructure | Interfaces in **Application** (improved) |
| In-memory repos for tests | Preserved |
| SQLite Prisma for repo integration tests | Testcontainers SQL Server |
| Vitest + Supertest | xUnit + `WebApplicationFactory` |
| `buildServer()` composition root | `Program.cs` + DI extension methods |
| Project-owner task auth | Unchanged in Application layer |

---

## Explicit Non-Decisions (Deferred)

| Topic | Status | Notes |
|-------|--------|-------|
| ASP.NET Identity | **Rejected for MVP** | Revisit only if product adds roles, 2FA, external providers |
| Minimal APIs | Deferred | Controllers first; evaluate per-endpoint later |
| SQL Server 2025 JSON/vector types | Deferred | No current domain need |
| Redis rate-limit backing | Deferred | Document when scaling horizontally |
| OpenTelemetry / structured logging | Deferred | Add ADR when observability wave starts |
| Frontend rewrite | Out of scope | React client continues against same REST contracts |

---

## Recommended Package Versions (Initial Pin)

Pin exact versions in `.csproj` during solution skeleton creation; update deliberately.

```
Microsoft.EntityFrameworkCore.SqlServer         10.0.*
Microsoft.EntityFrameworkCore.Design            10.0.*
Microsoft.AspNetCore.Authentication.JwtBearer   10.0.*
System.IdentityModel.Tokens.Jwt                 8.x
FluentValidation                                11.11.*
FluentValidation.DependencyInjectionExtensions  11.11.*
Konscious.Security.Cryptography.Argon2          1.3.*
xunit                                           2.9.*
FluentAssertions                                7.*
Moq                                             4.20.*
Testcontainers.MsSql                            4.*
Microsoft.AspNetCore.Mvc.Testing                10.0.*
coverlet.collector                              6.*
```

---

## Open Questions for Lead PM / Architect

1. **Public API versioning** — Keep unversioned `/auth`, `/projects`, `/tasks` paths (Node parity) or introduce `/v1` prefix during rewrite?
2. **ID format** — GUID strings in JSON vs. ULID/CUID-compatible strings for client migration?
3. **Monorepo layout** — Place .NET solution in repo root alongside Node (`/src` Node, `/dotnet` .NET) or replace Node tree in place?
4. **Assignee validation** — Port Node interim behavior (no assignee existence check) or add FK validation in .NET MVP?

---

**How to add new .NET decisions:**  
After a major choice during the rewrite, append an ADR entry here with `Status`, `Context`, `Decision`, `Rationale`, and `Consequences`. Cross-reference superseded Node ADRs in `DECISIONS.md` when behavior intentionally diverges.
