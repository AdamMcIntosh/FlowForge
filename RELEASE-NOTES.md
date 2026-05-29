# FlowForge Beta Release Notes

**Version:** `v0.1.0-beta`  
**Date:** 2026-05-29  
**Target:** .NET 10 / ASP.NET Core  
**Status:** Beta-ready for a controlled, low-traffic pilot

---

## Summary

FlowForge is a project and task management API built with Clean Architecture on .NET 10. This beta delivers end-to-end user authentication, ownership-authorized project and task CRUD, EF Core persistence (SQLite for development, SQL Server for production), production hardening, and **239 passing tests**.

**Recommended use:** Single-instance deployments with real but limited users on SQLite or a small SQL Server database. Supply all secrets via environment variables or a secret store — never commit production credentials.

---

## Key Features

### Domain and application layer

- **User aggregate** — Email-based identity, PBKDF2 password hashing, JWT issuance
- **Project aggregate** — Owner-scoped CRUD with immutable `OwnerId` per user
- **Task aggregate** — Project-scoped CRUD with authorization inherited through project ownership
- **Repository pattern** — Domain interfaces with EF Core and in-memory implementations for testing
- **Application services** — `UserService`, `ProjectService`, `TaskService` with explicit business exceptions

### HTTP API (Minimal APIs)

| Group | Endpoints |
|-------|-----------|
| **Auth** | `POST /register`, `POST /login` |
| **Profile** | `GET /me` (JWT required) |
| **Projects** | `POST/GET/PUT/DELETE /projects`, `GET /projects/{id}` |
| **Tasks** | Full CRUD under `/projects/{projectId}/tasks` |
| **Health** | `GET /health` (liveness + database readiness; no auth, no rate limit) |

All authenticated routes require `Authorization: Bearer <accessToken>`. Errors return [RFC 7807 ProblemDetails](https://datatracker.ietf.org/doc/html/rfc7807) with a `traceId` extension.

### Security and production hardening

- **JWT Bearer authentication** — HS256 symmetric signing; unique `jti` per token; configurable issuer, audience, and expiry
- **JWT secret validation at startup** — Fail-fast if secret is missing, shorter than 32 characters, has fewer than 8 distinct characters, or is a known dev placeholder in Production
- **Password policy** — 12–128 characters; requires uppercase, lowercase, digit, and special character
- **Partitioned rate limiting** — Fixed-window limits keyed by JWT `sub` (authenticated) or client IP (anonymous); proxy-aware when `TrustForwardedHeaders` is enabled
- **CORS** — Permissive in Development; strict allowlist in Production with startup fail-fast if origins are empty
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; HSTS in Production
- **Swagger/OpenAPI** — Development-only with JWT security definitions and XML comments; disabled in Production

### Data and persistence

- **SQLite default** for all non-Production environments (zero-setup local development)
- **SQL Server** for Production (`Database:Provider=SqlServer`)
- **Initial EF Core migration** (`20260529155708_InitialCreate`) authored against SQL Server; compatible with SQLite for dev/test
- **Database constraints:**
  - Unique email index on `Users`
  - Composite unique `(OwnerId, Name)` on `Projects`
  - Composite unique `(ProjectId, Name)` on `Tasks`
  - Typed foreign key from `Tasks` to `Projects` via alternate key on `ProjectId`
- **Auto-migrate** in non-Production; **manual** `dotnet ef database update` required in Production

### Observability and operations

- **TraceId correlation** — Propagated via middleware, response header (`X-Correlation-Id`), ProblemDetails, and structured logs
- **Serilog** — Console and rolling file sinks; compact JSON in Production file logs
- **Health checks** — `self` (live) and `database` (ready) tags on `/health`
- **Global exception handling** — Consistent ProblemDetails for validation, auth, not-found, forbidden, conflict, and server errors

### Input validation

- **FluentValidation** on all Auth, Project, and Task request DTOs
- Shared validation rules for names and passwords; invalid input returns **400** with ProblemDetails

---

## Architectural Decisions

These decisions are recorded in [DECISIONS.md](DECISIONS.md) and [ARCHITECTURE.MD](ARCHITECTURE.MD).

| Area | Decision |
|------|----------|
| **Architecture** | Clean Architecture — Domain → Application → Infrastructure → Api; dependency rule enforced |
| **API style** | ASP.NET Core Minimal APIs with endpoint extension methods |
| **ORM** | EF Core 10; configurations discovered via `ApplyConfigurationsFromAssembly` |
| **Database providers** | SQLite (dev/local/test); SQL Server (Production or explicit `Database:Provider=SqlServer`) |
| **Migrations** | Auto-apply in non-Production; explicit `dotnet ef database update` in Production |
| **Authentication** | JWT Bearer with PBKDF2 password hashing in Application layer |
| **Authorization** | Project ownership at Application layer; tasks authorized via parent project |
| **Error responses** | `IExceptionHandler` + `AddProblemDetails` for RFC 7807 compliance |
| **Duplicate names** | Database and in-memory collisions map to **409 Conflict** via `DuplicateConstraintViolationMapper` |
| **Rate limiting** | Partitioned fixed-window after authentication, before authorization |
| **Logging** | Serilog with TraceId enrichment via middleware scopes |
| **Swagger** | Development-only; Production guard prevents exposure |
| **Production CORS** | Fail-fast if `Cors:AllowedOrigins` is empty |
| **Design-time EF** | `FlowForgeDbContextFactory` defaults to SQL Server so migrations target the production provider |

### Middleware pipeline order

```
Forwarded headers → TraceId → Exception handler → Security headers → Swagger (dev) → CORS
  → Authentication → Rate limiter → Authorization → Endpoints
```

---

## Breaking Changes

This is the **initial beta release** — there is no prior public API version.

Integrators should be aware of these **stable contract requirements** from day one:

| Requirement | Detail |
|-------------|--------|
| **Password policy** | Passwords must meet complexity rules (12+ chars, mixed case, digit, special). Weaker passwords are rejected at registration. |
| **JWT secret** | Production deployments must supply `Jwt__Secret` (≥ 32 chars, ≥ 8 distinct chars). The dev placeholder is rejected in Production. |
| **Duplicate names** | Project names must be unique per owner; task names must be unique per project. Violations return **409 Conflict**, not 500. |
| **Ownership model** | Users can only access projects they own. Cross-owner access returns **403 Forbidden** (not 404). |
| **Rate limiting** | Auth and CRUD endpoints return **429** when limits are exceeded. Authenticated and anonymous clients have separate buckets. |
| **Production migrations** | Schema is **not** auto-applied in Production. Deployments must run `dotnet ef database update` explicitly. |
| **Swagger unavailable in Production** | Use Development/Swagger or maintain client contracts from [README.md](README.md). |

---

## Known Limitations

These items are acceptable for a controlled beta pilot but should be addressed before broader production rollout.

### P1 — Plan before scaling

| Limitation | Impact | Workaround / plan |
|------------|--------|-------------------|
| **No pagination** | `GET /projects` and `GET /projects/{id}/tasks` return unbounded lists | Keep datasets small during beta; add pagination before scale |
| **No `OwnerId` FK to Users** | Deleting a user could leave orphan projects (user deletion not exposed yet) | Do not delete users directly in the database |
| **No refresh tokens / revocation** | Stolen JWT remains valid until expiry | Use short `Jwt__ExpiryMinutes`; plan refresh/blacklist for production |
| **Symmetric JWT (HS256)** | Shared secret across all services | Acceptable for single-instance beta; consider RS256 or external IdP for multi-service production |
| **Production connection string** | Missing connection string fails at DI resolution, not with a dedicated startup message | Always set `ConnectionStrings__DefaultConnection` in deploy config |
| **Manual Production migrations** | Schema drift if migration step is skipped | Include `dotnet ef database update` in deploy pipeline |

### P2 — Post-beta improvements

- Split `/health` into separate liveness and readiness routes for orchestrators (tags `live` and `ready` already exist)
- Distributed rate limiting (Redis) for multi-instance deployments
- Account lockout and login throttling beyond global rate limits
- CI/CD pipeline with automated migration checks
- Explicit test that `GET /swagger/v1/swagger.json` returns 404 in Production

---

## Setup Instructions

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)

### Local development (SQLite)

```bash
git clone <repository-url>
cd FlowForge
dotnet restore
dotnet build
dotnet test
dotnet run --project src/FlowForge.Api
```

Default URL: `http://localhost:5182`  
Swagger UI (Development only): `http://localhost:5182/swagger`

SQLite and a dev JWT secret are configured in `appsettings.json`. Migrations apply automatically on startup.

**Quick smoke test:**

```bash
BASE=http://localhost:5182

RESP=$(curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"SecurePass123!"}')
TOKEN=$(echo "$RESP" | jq -r .accessToken)

curl -s "$BASE/me" -H "Authorization: Bearer $TOKEN"
```

See [README.md](README.md) for full API examples (Projects, Tasks, validation errors, rate limiting).

### Environment variables

Copy [`.env.example`](.env.example) as a reference. The app does **not** auto-load `.env` files:

```bash
set -a && source .env && set +a
dotnet run --project src/FlowForge.Api
```

| Variable | Required | Notes |
|----------|----------|-------|
| `Jwt__Secret` | **Yes** | ≥ 32 chars; use secret store in Production |
| `ConnectionStrings__DefaultConnection` | **Yes** | SQLite locally; SQL Server in Production |
| `Database__Provider` | No | `Sqlite` (default) or `SqlServer` |
| `Cors__AllowedOrigins__0` | **Yes in Production** | Startup fails if empty |
| `RateLimiting__PermitLimit` | No | Default 100 (dev) / 60 (prod) |
| `RateLimiting__AuthenticatedPermitLimit` | No | Per-user bucket (Production default: 60/min) |
| `RateLimiting__AnonymousPermitLimit` | No | Per-IP bucket (Production default: 20/min) |

### Production deployment checklist

1. Set `ASPNETCORE_ENVIRONMENT=Production`
2. Provide `Jwt__Secret` via environment or secret store — **never** in `appsettings.Production.json`
3. Set `ConnectionStrings__DefaultConnection` to your SQL Server connection string
4. Confirm `Database__Provider=SqlServer`
5. Set `Cors__AllowedOrigins__*` to your frontend origin(s)
6. Run migrations **before** starting the app:

   ```bash
   dotnet ef database update \
     --project src/FlowForge.Infrastructure \
     --startup-project src/FlowForge.Api
   ```

7. Serve behind HTTPS (HSTS enabled in Production)
8. Review rate limits, `AllowedHosts`, and Serilog settings in `appsettings.Production.json`

---

## Upgrade Notes

### Fresh install (recommended for beta)

1. Clone the repository and check out tag `v0.1.0-beta`
2. Configure environment variables (see above)
3. Run `dotnet ef database update` in Production, or let auto-migrate handle non-Production
4. Register a user via `POST /register` and use the returned JWT for all CRUD operations

### From pre-beta development builds

If you have been running earlier development builds against a local SQLite file:

1. **Backup** `flowforge.db` if it contains data you need
2. Pull `v0.1.0-beta` and rebuild
3. Delete the old SQLite file or run `dotnet ef database update` to apply `20260529155708_InitialCreate`
4. **Re-register users** — password policy is now enforced (12+ chars with complexity); old weak passwords will not pass validation
5. **Update clients** to handle **409 Conflict** for duplicate project/task names (previously could surface as 500)
6. **Production deploys** must supply a non-placeholder `Jwt__Secret` — the startup validator rejects dev secrets in Production

### Database migration identifier

| Migration | Description |
|-----------|-------------|
| `20260529155708_InitialCreate` | Users, Projects, Tasks with composite unique indexes and Project→Task FK |

---

## Verification (Final Beta Review)

Independent verification at release time:

| Check | Result |
|-------|--------|
| `dotnet build` | 0 warnings, 0 errors |
| `dotnet test tests/FlowForge.Tests/` | **239 / 239 passed** |
| `dotnet list package --vulnerable` | No vulnerable packages |
| P0 blockers (rate-limiter ordering, 409 handling, JWT validation, prod config) | All resolved |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Local setup, env vars, API examples, deployment |
| [ARCHITECTURE.MD](ARCHITECTURE.MD) | Layer structure, ownership model, P0 fixes, pipeline |
| [DECISIONS.md](DECISIONS.md) | Architecture decision records |
| [.env.example](.env.example) | Environment variable reference |

---

## Suggested Git Tag

```bash
git tag -a v0.1.0-beta -m "FlowForge beta: User/Project/Task CRUD, JWT auth, production hardening"
git push origin v0.1.0-beta
```

---

*Generated for the FlowForge beta release verification wave — 2026-05-29.*
