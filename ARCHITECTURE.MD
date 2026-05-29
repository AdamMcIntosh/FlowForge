# FlowForge Architecture

## Overview

FlowForge is a Task and Project management system built with **.NET 10** using **Clean Architecture**.

## Layered Structure

- **FlowForge.Domain** — Entities, Value Objects, Repository Interfaces
- **FlowForge.Application** — Use Cases, Services, Business Logic, Application Exceptions
- **FlowForge.Infrastructure** — EF Core, Repositories, JWT, External Services, Persistence
- **FlowForge.Api** — Minimal API Endpoints, Middleware, Configuration, Program.cs

## Key Design Principles

- **Dependency Rule:** Outer layers depend on inner layers (never the reverse)
- **Domain Purity:** Domain contains no infrastructure or framework references
- **Explicit Contracts:** All dependencies are expressed through interfaces
- **Testability:** All layers are independently testable

## Technology Stack

- **Framework:** .NET 10 + ASP.NET Core
- **ORM:** Entity Framework Core 10 with SQLite (dev/local) and SQL Server (production)
- **Authentication:** JWT Bearer (PBKDF2 password hashing; startup secret validation)
- **Testing:** xUnit + WebApplicationFactory + SQLite in-memory
- **API Style:** Minimal APIs with RFC 7807 ProblemDetails, FluentValidation, Swagger/OpenAPI

## Current State (May 2026)

**239/239 tests pass.** User, Project, and Task aggregates are implemented from domain through HTTP endpoints, with ownership authorization, global exception handling, partitioned rate limiting, health checks, Serilog, and production hardening.

| Layer | Highlights |
|-------|------------|
| **Domain** | `User`, `Project`, `Task` aggregates; typed IDs and value objects; repository interfaces with owner/project-scoped queries |
| **Application** | `UserService`, `ProjectService`, `TaskService`; PBKDF2 + JWT; business exceptions mapped to HTTP by the API |
| **Infrastructure** | EF Core `InitialCreate` migration; unique indexes on email, `(OwnerId, Name)`, `(ProjectId, Name)`; typed FK Project→Task; dual EF + InMemory repositories |
| **API** | Auth, Me, Project, Task endpoints; TraceId middleware; Serilog; CORS/security headers; Swagger (non-Production) |

See [DECISIONS.md](DECISIONS.md) for recorded ADRs. [README.md](README.md) covers setup, env vars, and API examples.

## P0 Beta Blocker Fixes (May 2026)

Four pre-beta blockers were resolved in the API layer. All are covered by integration/unit tests; full suite: **239 passed**.

### 1. Rate-limiter middleware ordering

The pipeline runs rate limiting **immediately after authentication and before authorization**:

```
UseAuthentication → UseRateLimiter → UseAuthorization
```

**Why:** `RateLimitPartitionKeyResolver` keys authenticated buckets on JWT `sub`. Running the limiter after auth ensures `sub` is available for protected routes; unauthenticated traffic to those routes is still limited by client IP before authorization returns 401.

`/health` remains excluded via `DisableRateLimiting()`.

### 2. Duplicate-name → 409 Conflict

`DuplicateConstraintViolationMapper` (checked by `GlobalExceptionHandler` before the 500 fallback) maps duplicate project/task names to **409 Conflict** with RFC 7807 ProblemDetails:

| Field | Value |
|-------|-------|
| Title | `Duplicate name` |
| Detail | `A resource with this name already exists.` |
| Extension | `traceId` (from TraceId middleware) |

**Sources mapped:**

- **EF Core** — `DbUpdateException` with SQLite unique constraint (`SQLITE_CONSTRAINT_UNIQUE` / error 19) or SQL Server (2627/2601)
- **In-memory repos** — `InvalidOperationException` messages for project/task name collisions (unit tests)

Duplicate **email** on register continues to map via `DuplicateEmailException` (same 409 shape, different title/detail).

### 3. JWT secret validation (startup fail-fast)

`AddFlowForgeJwtAuthentication` calls `JwtSecretValidator.Validate` before JWT Bearer is registered. The host **does not start** if validation fails (`InvalidOperationException`).

| Check | Rule |
|-------|------|
| Required | `Jwt:Secret` must be non-empty |
| Length | ≥ 32 characters |
| Entropy | ≥ 8 distinct characters |
| Production placeholders | Rejects known dev/template secrets (e.g. `FlowForge-Dev-Secret-Key-At-Least-32-Chars!`) |

Development uses the dev secret from `appsettings.json`; Production must supply a real secret via environment or secret store (`Jwt__Secret`).

### 4. Production config cleanup

`appsettings.Production.json` contains **no secrets**:

- No `Jwt:Secret` (env/secrets only)
- No `ConnectionStrings` placeholder (use `ConnectionStrings__DefaultConnection` env var)
- Non-secret settings only: Serilog, `AllowedHosts`, `Database:Provider` (SqlServer), JWT issuer/audience/expiry, rate limiting, CORS, HSTS

## HTTP Pipeline (API)

Middleware order in `Program.cs` (simplified):

1. Forwarded headers (when configured)
2. TraceId correlation
3. Exception handler (`GlobalExceptionHandler` → ProblemDetails)
4. Security headers, Swagger (non-Production), CORS
5. **Authentication → Rate limiter → Authorization**
6. Endpoint mapping (Auth, Me, Projects, Tasks; `/health` without rate limit)

Non-Production environments auto-apply EF migrations on startup; Production requires explicit `dotnet ef database update`.

## Project ownership

Projects carry an immutable `OwnerId` (`UserId`) set at construction. Tasks inherit authorization through their parent project via `TaskService` → `ProjectService.GetOwnedProjectAsync`.

| Operation | Authorization |
|-----------|---------------|
| **Create project** | Caller's `UserId` becomes `OwnerId` |
| **List / CRUD project** | Owner-scoped via `ProjectService` |
| **Task CRUD** | Project must exist and caller must own it |

| Exception | HTTP | Meaning |
|-----------|------|---------|
| `ProjectNotFoundException` / `TaskNotFoundException` | 404 | Unknown id |
| `UnauthorizedProjectAccessException` | 403 | Resource exists but caller is not the owner |
| Duplicate name (DB or in-memory) | 409 | Composite unique index violated |
| `DuplicateEmailException` | 409 | Email already registered |

## Next Major Milestones

- Distributed rate limiting / Redis backing for multi-instance deployments
- JWT refresh tokens and revocation (`jti` blocklist)
- CI pipeline and automated migration checks in deploy
- Optional `OwnerId` FK to Users table for referential integrity at the DB layer
