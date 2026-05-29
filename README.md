# FlowForge

.NET 10 Clean Architecture API with JWT authentication.

## Run

```bash
dotnet run --project src/FlowForge.Api
```

Default URL: `http://localhost:5182` (see `src/FlowForge.Api/Properties/launchSettings.json`).

Copy `.env.example` to `.env` for local overrides (connection string, JWT settings).

## API

### Register and login

Obtain an access token via `POST /register` or `POST /login`:

```bash
curl -s -X POST http://localhost:5182/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"SecurePass123!"}'
```

**Response (200 OK):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "you@example.com"
}
```

Save `accessToken` for authenticated requests.

### Current user (`GET /me`)

Returns the authenticated user's id and email. Requires a valid JWT in the `Authorization` header.

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

**Without a token (401 Unauthorized):** omit the header or send an invalid/expired token.

**User not found (404 Not Found):** token is valid but no user exists for the `sub` claim (rare after normal register/login).

### Projects (ownership-authorized)

Ownership-authorized use cases are implemented in `IProjectService` / `ProjectService`. The curl examples below describe the intended protected HTTP API (routes not yet wired in `FlowForge.Api`).

Every project has an immutable `OwnerId` set at creation. List, get, update, and delete operations are scoped to the authenticated user: callers only see and modify projects they own. The API passes the JWT `sub` claim as `ownerId` to `IProjectService`.

| Operation | Service method | Authorization |
|-----------|----------------|---------------|
| Create | `CreateAsync(ownerId, name)` | `OwnerId` is set from the authenticated user |
| List | `GetAllAsync(ownerId)` | Returns only projects where `OwnerId` matches |
| Get by id | `GetByIdAsync(id, ownerId)` | Owner must match; see exceptions below |
| Update | `UpdateAsync(id, ownerId, name)` | Owner must match; renames and updates `UpdatedAt` |
| Delete | `DeleteAsync(id, ownerId)` | Owner must match |

**Exceptions** (thrown by `ProjectService`; map to HTTP when endpoints are wired):

| Exception | When | Intended HTTP |
|-----------|------|-----------------|
| `ProjectNotFoundException` | No project exists for the given id | **404 Not Found** |
| `UnauthorizedProjectAccessException` | Project exists but belongs to another user | **403 Forbidden** |

Missing or invalid JWT → **401 Unauthorized** (same as `/me`).

#### Example calls

Obtain a token first (see [Register and login](#register-and-login)). All project routes require `Authorization: Bearer $TOKEN`; the server derives `ownerId` from the token — do not send `ownerId` in the request body.

**Create** — `POST /projects`

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

**List owned projects** — `GET /projects`

```bash
curl -s http://localhost:5182/projects \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):** JSON array of project objects (only those owned by the authenticated user).

**Get by id** — `GET /projects/{id}`

```bash
PROJECT_ID="7c9e6679-7425-40de-944b-e07fc1f90ae7"

curl -s "http://localhost:5182/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Update** — `PUT /projects/{id}`

```bash
curl -s -X PUT "http://localhost:5182/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Renamed Flow"}'
```

**Delete** — `DELETE /projects/{id}`

```bash
curl -s -X DELETE "http://localhost:5182/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content)** on success.

**Error responses** use RFC 7807 `ProblemDetails`:

```json
{
  "title": "Project not found",
  "detail": "Project with id '7c9e6679-7425-40de-944b-e07fc1f90ae7' was not found.",
  "status": 404
}
```

```json
{
  "title": "Forbidden",
  "detail": "You are not authorized to access project '7c9e6679-7425-40de-944b-e07fc1f90ae7'.",
  "status": 403
}
```

Another user's project id returns **403** (not **404**) so existence is not leaked to non-owners.

### Health

```bash
curl -s http://localhost:5182/health
```
