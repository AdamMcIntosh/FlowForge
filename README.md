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

### Health

```bash
curl -s http://localhost:5182/health
```
