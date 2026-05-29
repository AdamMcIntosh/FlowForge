# FlowForge

.NET 10 Clean Architecture API for project and task management with JWT authentication.

See [ARCHITECTURE.MD](ARCHITECTURE.MD) and [DECISIONS.md](DECISIONS.md) for design details.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)

## Local setup

```bash
git clone <repository-url>
cd FlowForge
dotnet restore
dotnet build
dotnet test
dotnet run --project src/FlowForge.Api
```

Default URL: `http://localhost:5182` (see `src/FlowForge.Api/Properties/launchSettings.json`).

In **Development**, Swagger UI is available at `http://localhost:5182/swagger`. It is disabled in Production.

### Quick start (register → project → task)

```bash
BASE=http://localhost:5182

# Register and capture token
RESP=$(curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"SecurePass123!"}')
TOKEN=$(echo "$RESP" | jq -r .accessToken)

# Create a project
PROJECT=$(curl -s -X POST "$BASE/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Flow"}')
PROJECT_ID=$(echo "$PROJECT" | jq -r .id)

# Create a task
curl -s -X POST "$BASE/projects/$PROJECT_ID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Task"}'
```

## Configuration

ASP.NET Core merges `appsettings.json`, environment-specific files (`appsettings.Development.json`, `appsettings.Production.json`), and environment variables. Use double underscores for nested keys (e.g. `Jwt__Secret` → `Jwt:Secret`).

Copy [`.env.example`](.env.example) to `.env` as a reference. The app does **not** auto-load `.env` files — export variables before running:

```bash
set -a && source .env && set +a
dotnet run --project src/FlowForge.Api
```

Or set individual variables:

```bash
export Jwt__Secret="your-secret-at-least-32-characters-long"
export ConnectionStrings__DefaultConnection="Data Source=flowforge.db"
```

### Environment variables

| Variable | Required | Default (Development) | Description |
|----------|----------|---------------------|-------------|
| `ASPNETCORE_ENVIRONMENT` | No | `Development` | `Development`, `Staging`, or `Production` |
| `ConnectionStrings__DefaultConnection` | **Yes** | `Data Source=flowforge.db` | Database connection string |
| `Database__Provider` | No | `Sqlite` | `Sqlite` or `SqlServer` |
| `Jwt__Secret` | **Yes** | Dev value in `appsettings.json` | HMAC signing key (≥ 32 chars). **Must be set via environment in Production** — not stored in `appsettings.Production.json` |
| `Jwt__Issuer` | No | `FlowForge` | JWT issuer claim |
| `Jwt__Audience` | No | `FlowForge` | JWT audience claim |
| `Jwt__ExpiryMinutes` | No | `60` | Access token lifetime in minutes |
| `RateLimiting__PermitLimit` | No | `100` (dev), `60` (prod) | Max requests per window per client |
| `RateLimiting__WindowSeconds` | No | `60` | Fixed-window duration in seconds |
| `Cors__AllowedOrigins__0` | **Yes in Production** | N/A (permissive in dev) | Allowed CORS origin. Add `__1`, `__2`, … for additional origins |
| `AllowedHosts` | No | `*` (dev) | Semicolon-separated host filter (Production: `flowforge.example.com;api.flowforge.example.com`) |
| `Hsts__MaxAgeDays` | No | `365` | HSTS max-age in days (Production only) |
| `Hsts__IncludeSubDomains` | No | `true` | Include subdomains in HSTS (Production only) |
| `Hsts__Preload` | No | `false` | Enable HSTS preload (Production only) |

### Startup validation

The application fails fast at startup when:

- `Jwt:Secret` is missing
- `ConnectionStrings:DefaultConnection` is missing
- `Cors:AllowedOrigins` is empty in **Production**

## Database

FlowForge uses **SQLite by default** for local development and testing. **SQL Server** is configured for Production via `appsettings.Production.json`.

| Setting | Development (default) | Production |
|---------|----------------------|------------|
| `Database:Provider` | `Sqlite` | `SqlServer` |
| `ConnectionStrings:DefaultConnection` | `Data Source=flowforge.db` | SQL Server connection string |

Provider selection happens in `AddInfrastructure` (`FlowForge.Infrastructure/DependencyInjection.cs`). Set `Database:Provider` to `Sqlite` or `SqlServer`; if omitted, **Sqlite** is used.

**Non-Production:** migrations apply automatically on startup (`ApplyMigrationsInNonProductionAsync`).

**Production:** migrations are **not** applied automatically. Run explicitly before or during deployment:

```bash
export ASPNETCORE_ENVIRONMENT=Production
export Database__Provider=SqlServer
export ConnectionStrings__DefaultConnection="Server=...;Database=FlowForge;..."
export Jwt__Secret="your-production-secret-at-least-32-chars"

dotnet ef database update \
  --project src/FlowForge.Infrastructure \
  --startup-project src/FlowForge.Api
```

**Switch to SQL Server locally** (override via environment):

```bash
export Database__Provider=SqlServer
export ConnectionStrings__DefaultConnection="Server=localhost;Database=FlowForge;Trusted_Connection=True;TrustServerCertificate=True;"
dotnet run --project src/FlowForge.Api
```

Integration tests use SQLite in-memory via `WebApplicationFactory` overrides; no external database is required for `dotnet test`.

## Health checks

```bash
curl -s -i http://localhost:5182/health
```

| Check | Tag | Purpose |
|-------|-----|---------|
| `self` | `live` | Application process is running |
| `database` | `ready` | EF Core can connect to the configured database |

**Response:** `200 OK` with body `Healthy` when all checks pass.

`/health` is **excluded from rate limiting** and does not require authentication.

Every response includes an `X-Correlation-Id` header (see [Observability](#observability)).

## Rate limiting

Auth and CRUD endpoints use a **fixed-window** rate limiter (`RateLimitPolicies.FixedWindow`):

| Endpoint group | Routes |
|----------------|--------|
| Auth | `POST /register`, `POST /login` |
| Me | `GET /me` |
| Projects | `POST/GET/PUT/DELETE /projects`, `GET /projects/{id}` |
| Tasks | All `/projects/{projectId}/tasks` routes |

| Environment | Default limit |
|-------------|---------------|
| Development | 100 requests / 60 seconds |
| Production | 60 requests / 60 seconds |

When exceeded, the API returns **429 Too Many Requests** with RFC 7807 ProblemDetails:

```json
{
  "title": "Too many requests",
  "status": 429,
  "detail": "Rate limit exceeded. Please try again later.",
  "traceId": "abc123..."
}
```

A `Retry-After` header (seconds) is included when available. `/health` is never rate-limited.

## Observability

Each request receives a **TraceId** correlation ID:

- Generated automatically, or taken from `X-Correlation-Id` / `X-Request-Id` request headers
- Returned on every response as `X-Correlation-Id`
- Included in ProblemDetails as `traceId`
- Propagated to structured logs via `ILogger` scopes

## Production deployment

### Checklist

1. Set `ASPNETCORE_ENVIRONMENT=Production`
2. Provide **`Jwt__Secret`** via environment or secret store (never commit production secrets)
3. Configure **`ConnectionStrings__DefaultConnection`** for SQL Server
4. Set **`Cors__AllowedOrigins__*`** to your frontend origin(s) — startup fails if empty
5. Review **`AllowedHosts`**, rate limits, and logging levels in `appsettings.Production.json`
6. Run **`dotnet ef database update`** before starting the app (auto-migration is disabled in Production)
7. Serve behind HTTPS — HSTS is enabled in Production

### Security headers

All environments receive:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Restrictive feature list |

Production additionally enables **HSTS** (configurable via `Hsts:*` settings).

### CORS

- **Development:** all origins allowed (permissive policy for local work)
- **Production:** only origins listed in `Cors:AllowedOrigins` are permitted; misconfiguration causes startup failure

### Swagger

OpenAPI/Swagger is **Development-only**. `/swagger` returns 404 in Production.

---

## API

All endpoints return JSON. Authenticated routes require `Authorization: Bearer <accessToken>`. Auth, project, and task routes are rate-limited (see [Rate limiting](#rate-limiting)).

Errors use [RFC 7807 ProblemDetails](https://datatracker.ietf.org/doc/html/rfc7807) (`application/problem+json`). Validation failures and unhandled domain exceptions share the same shape:

```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Invalid request",
  "status": 400,
  "detail": "Email is required.",
  "traceId": "abc123..."
}
```

---

### Register and login

**Request body** (both endpoints):

```json
{
  "email": "you@example.com",
  "password": "SecurePass123!"
}
```

#### `POST /register`

Creates a user and returns a JWT.

```bash
curl -s -X POST http://localhost:5182/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"SecurePass123!"}'
```

**Response (201 Created):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "you@example.com"
}
```

#### `POST /login`

Authenticates an existing user and returns a JWT.

```bash
curl -s -X POST http://localhost:5182/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"SecurePass123!"}'
```

**Response (200 OK):** same JSON shape as register (`accessToken`, `userId`, `email`).

Save `accessToken` for authenticated requests.

#### Validation errors (400 Bad Request)

Register and login validate input with FluentValidation before calling the service. Invalid payloads return **400** with title `"Invalid request"`:

| Condition | `detail` |
|-----------|----------|
| Missing or whitespace email | `Email is required.` |
| Invalid email format | `Email address format is invalid.` |
| Email longer than 320 characters | `Email address is too long.` |
| Missing or whitespace password | `Password is required.` |

Example — empty email:

```bash
curl -s -X POST http://localhost:5182/register \
  -H "Content-Type: application/json" \
  -d '{"email":"","password":"SecurePass123!"}'
```

```json
{
  "title": "Invalid request",
  "status": 400,
  "detail": "Email is required."
}
```

#### Business errors

| Situation | Status | `title` | `detail` |
|-----------|--------|---------|----------|
| Duplicate email on register | 409 | `Duplicate email` | `A user with this email already exists.` |
| Wrong email or password on login | 401 | `Invalid credentials` | `Invalid email or password.` |

---

### Current user (`GET /me`)

Returns the authenticated user's id and email.

```bash
TOKEN="<accessToken from login or register>"

curl -s http://localhost:5182/me \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "you@example.com"
}
```

**Without a token (401 Unauthorized):**

```json
{
  "title": "Unauthorized",
  "status": 401,
  "detail": "Authentication is required to access this resource."
}
```

**User not found (404 Not Found):** token is valid but no user exists for the `sub` claim (rare after normal register/login).

```json
{
  "title": "User not found",
  "status": 404,
  "detail": "No user exists for the authenticated subject."
}
```

---

### Projects (ownership-authorized)

Every project has an immutable `ownerId` set at creation from the JWT `sub` claim. List, get, update, and delete operations are scoped to the authenticated user — callers only see and modify projects they own. Do not send `ownerId` in the request body.

All project routes require `Authorization: Bearer $TOKEN`.

#### `POST /projects` — create

**Request body:**

```json
{
  "name": "My Flow"
}
```

```bash
curl -s -X POST http://localhost:5182/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Flow"}'
```

**Response (201 Created):**

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "My Flow",
  "ownerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "createdAt": "2026-05-28T12:00:00+00:00",
  "updatedAt": "2026-05-28T12:00:00+00:00"
}
```

#### `GET /projects` — list owned projects

```bash
curl -s http://localhost:5182/projects \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):** JSON array of project objects (only those owned by the authenticated user).

#### `GET /projects/{id}` — get by id

```bash
PROJECT_ID="7c9e6679-7425-40de-944b-e07fc1f90ae7"

curl -s "http://localhost:5182/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):** single project object (same shape as create response).

#### `PUT /projects/{id}` — update

**Request body:**

```json
{
  "name": "Renamed Flow"
}
```

```bash
curl -s -X PUT "http://localhost:5182/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Renamed Flow"}'
```

**Response (200 OK):** updated project object.

#### `DELETE /projects/{id}` — delete

```bash
curl -s -X DELETE "http://localhost:5182/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content)** on success.

#### Validation errors (400 Bad Request)

Project names must be non-empty (after trim) and at most 200 characters.

| Condition | `detail` |
|-----------|----------|
| Missing or whitespace name | `Project name is required.` |
| Name longer than 200 characters | `Project name is too long.` |

Example:

```json
{
  "title": "Invalid request",
  "status": 400,
  "detail": "Project name is required."
}
```

#### Authorization and not-found errors

| Situation | Status | `title` | `detail` |
|-----------|--------|---------|----------|
| Project does not exist | 404 | `Project not found` | `The requested project was not found.` |
| Project belongs to another user | 403 | `Forbidden` | `You are not authorized to access this project.` |
| Missing or invalid JWT | 401 | `Unauthorized` | `Authentication is required to access this resource.` |

Another user's project id returns **403** (not **404**) so existence is not leaked to non-owners.

---

### Tasks (project-scoped, ownership-authorized)

Tasks belong to a project. All task routes live under `/projects/{projectId}/tasks` and require the caller to own the parent project (same JWT `sub` → `ownerId` check as projects).

All task routes require `Authorization: Bearer $TOKEN`.

#### `POST /projects/{projectId}/tasks` — create

**Request body:**

```json
{
  "name": "My Task"
}
```

```bash
curl -s -X POST "http://localhost:5182/projects/$PROJECT_ID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Task"}'
```

**Response (201 Created):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "projectId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "My Task",
  "createdAt": "2026-05-28T12:00:00+00:00",
  "updatedAt": "2026-05-28T12:00:00+00:00"
}
```

#### `GET /projects/{projectId}/tasks` — list tasks

```bash
curl -s "http://localhost:5182/projects/$PROJECT_ID/tasks" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):** JSON array of task objects.

#### `GET /projects/{projectId}/tasks/{taskId}` — get by id

```bash
TASK_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"

curl -s "http://localhost:5182/projects/$PROJECT_ID/tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):** single task object.

#### `PUT /projects/{projectId}/tasks/{taskId}` — update

**Request body:**

```json
{
  "name": "Renamed Task"
}
```

```bash
curl -s -X PUT "http://localhost:5182/projects/$PROJECT_ID/tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Renamed Task"}'
```

**Response (200 OK):** updated task object.

#### `DELETE /projects/{projectId}/tasks/{taskId}` — delete

```bash
curl -s -X DELETE "http://localhost:5182/projects/$PROJECT_ID/tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content)** on success.

#### Validation errors (400 Bad Request)

Task names must be non-empty (after trim) and at most 200 characters.

| Condition | `detail` |
|-----------|----------|
| Missing or whitespace name | `Task name is required.` |
| Name longer than 200 characters | `Task name is too long.` |

Example:

```json
{
  "title": "Invalid request",
  "status": 400,
  "detail": "Task name is required."
}
```

#### Authorization and not-found errors

| Situation | Status | `title` | `detail` |
|-----------|--------|---------|----------|
| Task or project does not exist | 404 | `Task not found` or `Project not found` | `The requested task was not found.` or `The requested project was not found.` |
| Parent project belongs to another user | 403 | `Forbidden` | `You are not authorized to access this project.` |
| Missing or invalid JWT | 401 | `Unauthorized` | `Authentication is required to access this resource.` |
