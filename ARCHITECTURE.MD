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
- **Authentication:** JWT Bearer (PBKDF2 password hashing)
- **Testing:** xUnit + WebApplicationFactory + SQLite in-memory
- **API Style:** Minimal APIs

## Current State (May 2026)

**60/60 tests pass.** User and Project are fully implemented from domain through HTTP endpoints.

### Domain

Shared primitives under `Common/`:

- **`BaseEntity`** — `Id` (Guid), `CreatedAt`, `UpdatedAt`
- **`ValueObject`** — structural equality via `GetEqualityComponents()`

**User aggregate** (`Users/`):

| Type | Role |
|------|------|
| `User` | Aggregate root; optional `PasswordHash`; `SetPasswordHash` for updates |
| `UserId` | Identity value object (`New()`, `From(Guid)`; rejects empty) |
| `Email` | Normalized (trim + lowercase), max 320, regex validation |
| `PasswordHash` | Non-empty, max 512 chars |
| `IUserRepository` | Six async CRUD methods + `FindByEmailAsync` |

**Project aggregate** (`Projects/`):

| Type | Role |
|------|------|
| `Project` | Aggregate root; immutable `OwnerId` (`UserId`); `Rename` |
| `ProjectId` | Same pattern as `UserId` |
| `IProjectRepository` | Nine async methods including owner-scoped `GetByIdForOwnerAsync`, `GetAllByOwnerAsync`, plus `FindByNameAsync` |

Both aggregates use a **dual-ID pattern**: `BaseEntity.Id` and typed id value (`UserId.Value`, `ProjectId.Value`) are synchronized in constructors. EF Core uses private parameterless constructors for materialization; business construction goes through public constructors with validation.

Domain validation throws BCL exceptions (`ArgumentException`, `ArgumentNullException`). Application-layer services own business exceptions (duplicate email, invalid credentials, project not found, unauthorized access).

### Application

Services use **primary constructor injection** and accept `CancellationToken cancellationToken = default` on every async method.

**`UserService`** (`IUserRepository`, `IPasswordHasher`, `IJwtTokenService`):

- CRUD pass-through plus `GetByEmailAsync`
- `RegisterAsync` / `LoginAsync` with PBKDF2 hashing and JWT issuance
- `CreateAsync` has no duplicate-email guard (relies on DB unique index); only `RegisterAsync` checks proactively

**`ProjectService`** (`IProjectRepository`):

- Owner-scoped create, list, get, update, delete
- `GetByNameAsync` exists but is not exposed via HTTP

**Auth support:**

- `Pbkdf2PasswordHasher` — PBKDF2-SHA256, 100,000 iterations; stored as `{iterations}.{base64Salt}.{base64Hash}`
- `JwtTokenService` — `sub` = user Guid string; unique `jti`; optional roles; config from `Jwt:*` settings

### Infrastructure

**EF Core** (`FlowForgeDbContext`, primary constructor):

- `DbSet<User>`, `DbSet<Project>`
- Configurations discovered via `ApplyConfigurationsFromAssembly`
- `UserConfiguration` — unique index on email; value conversions for `UserId`, `Email`, `PasswordHash?`
- `ProjectConfiguration` — indexes on `OwnerId` and `Name` (non-unique); value conversions for `ProjectId`, `OwnerId`, `Name`

**Dual repository strategy:**

| Implementation | Registered in DI | Used for |
|----------------|------------------|----------|
| `UserRepository` / `ProjectRepository` | Yes (scoped) | Production and integration tests |
| `InMemoryUserRepository` / `InMemoryProjectRepository` | No | Direct instantiation in unit tests only |

InMemory repositories use Prisma-style semantics (null on missing lookups; `InvalidOperationException` on constraint violations). **Note:** InMemory enforces globally unique project names; EF allows duplicate names across owners.

`AddInfrastructure(IConfiguration)` selects the provider from `Database:Provider` (default **Sqlite**). Production sets `SqlServer` in `appsettings.Production.json`. Integration tests use real EF Core on SQLite via `AddInfrastructure(options => options.UseSqlite(...))` or the configuration overload with `Database:Provider=Sqlite`, not InMemory repositories.

### API

Minimal API endpoint groups in `Endpoints/`:

| Group | Auth | Routes |
|-------|------|--------|
| Auth | Anonymous | `POST /register`, `POST /login` |
| Me | JWT required | `GET /me` |
| Projects | JWT required | `POST/GET /projects`, `GET/PUT/DELETE /projects/{id:guid}` |

Owner identity is extracted from JWT `sub` (or `ClaimTypes.NameIdentifier`) and parsed to `UserId.From(guid)`.

### Testing

| Area | Tests | Approach |
|------|-------|----------|
| InMemory repositories | 20 | Direct repo instantiation |
| UserService / ProjectService | 16 | EF Core + SQLite fixture (`UserServiceEfCoreFixture`) |
| ProjectRepository (EF) | 1 | OwnerId persistence via fixture |
| HTTP auth + projects | 21 | WebApplicationFactory + SQLite |
| JWT | 1 | Unit test for unique `jti` |
| Health | 1 | `GET /health` smoke test |

**Task domain:** not yet started (no source files).

## Project ownership

Projects carry an immutable `OwnerId` (`UserId`) set at construction. Authorization is enforced in **`ProjectService`** (application layer), not in HTTP middleware beyond JWT authentication.

| Operation | Authorization |
|-----------|---------------|
| **Create** | Caller's `UserId` becomes `OwnerId` |
| **List** | `GetAllByOwnerAsync(ownerId)` — never returns another user's projects |
| **Get / update / delete** | Load via `GetByIdAsync(id)`, then compare `project.OwnerId == ownerId` |

Repository owner-scoped methods (`GetByIdForOwnerAsync`, `GetAllByOwnerAsync`) exist and are used for list; get/update/delete intentionally use unscoped load plus owner comparison to preserve **404 vs 403 semantics**:

| Exception | HTTP | Meaning |
|-----------|------|---------|
| `ProjectNotFoundException` | 404 Not Found | Unknown project id |
| `UnauthorizedProjectAccessException` | 403 Forbidden | Project exists but caller is not the owner |

Protected project endpoints under `/projects` require a valid JWT. The API maps application exceptions to status codes; auth endpoints use `ProblemDetails` consistently, while project endpoints mix `ProblemDetails` (401/403) with plain string bodies for some 400/404 responses.

## Next Major Milestones

- Task domain entity, repository, and ownership-scoped use cases
- Task HTTP endpoints (following Project patterns)
- Align project endpoint error responses with auth endpoint `ProblemDetails` style
- EF migration strategy (currently `EnsureCreated` in tests; production migrations TBD)
- Production-grade configuration, observability, and CI/CD pipeline
