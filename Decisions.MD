# Architectural Decisions (FlowForge)

This document records key architectural and technical decisions for the FlowForge project.

## Core Architecture

**Decision:** Adopt Clean Architecture (Domain → Application → Infrastructure → API)
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Enforces dependency direction, improves testability, and maintains clear separation of concerns.
- **Consequences:** Domain remains pure; Infrastructure handles EF Core and external concerns. Repository interfaces live in Domain; implementations in Infrastructure.

**Decision:** Use Minimal APIs instead of Controllers
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Lightweight, explicit, and aligns with modern ASP.NET Core recommendations for smaller APIs.
- **Consequences:** Endpoints live in `Endpoints/` folder as static classes with `Map*Endpoints(this WebApplication app)` extension methods (`AuthEndpoints`, `MeEndpoints`, `ProjectEndpoints`).

**Decision:** Primary constructor injection for services and EF repositories
- **Date:** May 2026
- **Status:** Accepted
- **Rationale:** Reduces boilerplate on `UserService`, `ProjectService`, `UserRepository`, `ProjectRepository`, `FlowForgeDbContext`, and `JwtTokenService`.
- **Consequences:** Domain entities and InMemory repositories retain traditional constructors; endpoint classes remain static.

## Domain Layer

**Decision:** Use Value Objects for identities and critical primitives (UserId, Email, ProjectId, PasswordHash)
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Prevents primitive obsession and encapsulates validation rules.
- **Consequences:** Stronger type safety and better domain expressiveness. Factories (`Create`, `New`, `From`) centralize validation; invalid input throws BCL exceptions at construction time.

**Decision:** Dual-ID pattern on aggregates (BaseEntity.Id + typed value object)
- **Date:** May 2026
- **Status:** Accepted
- **Rationale:** `BaseEntity.Id` supports EF Core key mapping while `UserId` / `ProjectId` express domain identity explicitly.
- **Consequences:** Public constructors set `Id = userId.Value` / `Id = projectId.Value`. Private parameterless constructors exist for EF materialization only.

**Decision:** Repository interfaces defined in Domain layer
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Keeps Domain independent of persistence details while declaring required contracts.
- **Consequences:** `IUserRepository` (6 methods) and `IProjectRepository` (9 methods, including owner-scoped queries) are implemented in Infrastructure. All methods accept `CancellationToken cancellationToken = default`.

**Decision:** Application layer owns business exceptions; Domain uses BCL exceptions for validation
- **Date:** May 2026
- **Status:** Accepted
- **Rationale:** Separates invariant violations (domain) from use-case outcomes (application) such as duplicate registration or unauthorized project access.
- **Consequences:** Application exceptions include `DuplicateEmailException`, `InvalidCredentialsException`, `ProjectNotFoundException`, and `UnauthorizedProjectAccessException`. API endpoints map these to HTTP status codes.

**Decision:** Immutable project ownership via `OwnerId` at construction
- **Date:** May 2026
- **Status:** Accepted
- **Rationale:** Every project has exactly one owner; ownership does not change after creation.
- **Consequences:** `Project` exposes `UserId OwnerId` with a private setter. `ProjectService` enforces authorization on all mutating and single-resource read operations.

## Infrastructure & Persistence

**Decision:** Dual repository strategy (EF Core + InMemory implementations)
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Enables fast, isolated unit tests without DI or database while maintaining a production EF Core path.
- **Consequences:**
  - **Production DI:** `UserRepository` and `ProjectRepository` only (scoped).
  - **Unit tests:** `InMemoryUserRepository` and `InMemoryProjectRepository` instantiated directly; Prisma-style throw semantics on constraint violations.
  - **Integration tests:** Real EF Core on SQLite in-memory via `AddInfrastructure(Action<DbContextOptionsBuilder>)` overload — not InMemory repositories.
  - **Known divergence:** InMemory enforces globally unique project names; EF `ProjectConfiguration` indexes `Name` without a uniqueness constraint.

**Decision:** EF Core configurations discovered via assembly scanning
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Reduces boilerplate when adding new entities.
- **Consequences:** `UserConfiguration` and `ProjectConfiguration` are auto-discovered by `FlowForgeDbContext.OnModelCreating`. Keys use `ValueGeneratedNever()`; value objects map via explicit conversions.

**Decision:** Production SQL Server; tests override to SQLite
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Production targets SQL Server via `ConnectionStrings:DefaultConnection`; tests need no external database.
- **Consequences:** `AddInfrastructure(IConfiguration)` registers SQL Server; test fixtures and `WebApplicationFactory` subclasses call `AddInfrastructure(options => options.UseSqlite(...))` with a shared open in-memory connection.

## Authentication & Security

**Decision:** JWT Bearer with unique `jti` claim
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Prevents replay attacks and supports future token revocation.
- **Consequences:** Every access token includes `sub` (user Guid string), unique `jti` (Guid), and `iat`. Validated in `Program.cs` with issuer, audience, lifetime, and signing key checks (1-minute clock skew). Tested at service, endpoint, and unit levels.

**Decision:** PBKDF2-SHA256 password hashing in Application layer
- **Date:** May 2026
- **Status:** Accepted
- **Rationale:** Standard, framework-supported hashing without external dependencies.
- **Consequences:** `Pbkdf2PasswordHasher` registered as `IPasswordHasher` in `AddApplication`. Format: `{iterations}.{base64Salt}.{base64Hash}` (100,000 iterations, 16-byte salt, 32-byte key). `User.PasswordHash` is optional for users created without credentials.

**Decision:** Authorization enforced at use-case layer
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Keeps business rules close to the domain and avoids duplication across endpoints.
- **Consequences:**
  - **Projects:** `ProjectService.GetOwnedProjectAsync` loads by id, throws `ProjectNotFoundException` if missing, `UnauthorizedProjectAccessException` if `OwnerId` mismatch — preserving 404 vs 403 semantics rather than masking foreign-owned resources as not found.
  - **HTTP:** JWT middleware authenticates; endpoints extract `UserId` from `sub` claim via `TryGetOwnerId`. No role-based authorization yet.

**Decision:** Register and login return JWT immediately
- **Date:** May 2026
- **Status:** Accepted
- **Rationale:** Single round-trip for client onboarding and session establishment.
- **Consequences:** `POST /register` returns 201; `POST /login` returns 200. Both respond with `AuthResponse(AccessToken, UserId, Email)`. Duplicate email on register maps to 409 Conflict; bad credentials on login map to 401 Unauthorized.

## Testing Strategy

**Decision:** In-memory SQLite for integration and HTTP tests
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Fast feedback loop and no external service dependency during development.
- **Consequences:** Production uses SQL Server; tests use `Data Source=:memory:` with `EnsureCreated()`. `UserServiceEfCoreFixture` wires `AddInfrastructure` + `AddApplication` for service-layer tests; `AuthEndpointWebApplicationFactory` and `ProjectEndpointWebApplicationFactory` override DI for HTTP tests.

**Decision:** Layered test coverage for User and Project
- **Date:** May 2026
- **Status:** Accepted
- **Rationale:** Each layer validates behavior appropriate to its scope without over-mocking production paths.
- **Consequences:**
  - **InMemory repository unit tests** (20): constraint and CRUD behavior including ownership-scoped queries.
  - **EF-backed service integration tests** (16): `UserService` (register/login/auth exceptions) and `ProjectService` (CRUD + ownership exceptions) via shared fixture.
  - **EF repository integration test** (1): `ProjectRepository` OwnerId persistence.
  - **HTTP integration tests** (21): full auth flow (`/register`, `/login`, `/me`) and project CRUD with ownership authorization (15 tests in `ProjectEndpointTests`, including a 5-case theory for unauthenticated access).
  - **JwtTokenService unit test** (1): verifies unique `jti` per token.
  - **Health endpoint smoke test** (1): `GET /health`.

**Decision:** `CancellationToken` on all async repository and service methods
- **Date:** May 2026
- **Status:** Accepted
- **Rationale:** Consistent cooperative cancellation from API handlers through persistence.
- **Consequences:** EF repositories forward tokens to EF APIs; InMemory repositories call `ThrowIfCancellationRequested()` at method entry; ASP.NET Core injects tokens into endpoint handlers.
