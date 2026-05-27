# FlowForge Architecture

## Overview
Modern Task & Project Management application with Fastify backend and React frontend.

## Layered Architecture (Clean Architecture)

- **Domain**: Entities, Value Objects, Domain Events, Business Rules
- **Application**: Use Cases, Services, DTOs
- **Adapters**: Controllers, Repositories, External Services
- **Infrastructure**: Database (Prisma), Config, Logging, Rate Limiting

## Key Design Decisions
- JWT Authentication with short-lived access + refresh tokens (RS256, unique `jti`, refresh rotation)
- Layered rate limiting on `/auth/*` (early per-IP hook + per-IP/per-email on register/login)
- Zod for all input validation
- Prisma as ORM with repository pattern
- TanStack Query on frontend for state management

## Authentication

FlowForge uses stateless JWT access tokens and server-tracked refresh tokens. Auth logic follows Clean Architecture: domain rules and errors in `src/domain/auth/`, use cases in `src/application/auth/`, HTTP adapters in `src/adapters/auth/`, and crypto/DB/rate-limiting in `src/infrastructure/auth/`.

### Token model

| Token | Algorithm | TTL (default) | Claims | Storage |
|-------|-----------|---------------|--------|---------|
| Access | RS256 | 900 s (15 min) | `sub`, `email`, `jti`, `type: "access"`, `iat`, `exp` | Client only |
| Refresh | RS256 | 604 800 s (7 days) | `sub`, `jti`, `family`, `type: "refresh"`, `iat`, `exp` | Client + server record |

- **RS256:** Asymmetric signing with `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` from config. Public key can be distributed to verifiers without exposing signing capability.
- **Unique `jti`:** Every access and refresh token gets a fresh UUID `jti` at issuance (`token-pair.ts`, `jwt-service.ts`).
- **Refresh families:** Each login/register starts a new `family` UUID. Rotation reuses the same family so replay of an already-rotated token revokes the entire family.
- **Refresh token states:** `active` → `rotated` (on successful refresh) or `revoked` (on logout). Presenting a `rotated` token triggers family-wide revocation (replay detection).

Passwords are hashed with **Argon2id** before persistence. Login failures for unknown email and wrong password both return the same `401` message to prevent credential enumeration.

### Request flow

```
POST /auth/register | /login | /logout | /refresh
  → registerEarlyRateLimit (onRequest, before body parse)
  → authRoutes → createAuthController
  → Zod parse (registerInputSchema | loginInputSchema | logoutInputSchema | refreshInputSchema)
  → enforceEmailRateLimit (register/login only — IP + normalized email keys)
  → authUseCases.register | login | logout | refresh
  → sendMappedAuthError on failure
```

Early rate limiting runs in `server.ts` via `registerEarlyRateLimit(app, { rateLimiter, pathPrefix: '/auth' })`. Register and login add a second check after Zod validation using both client IP and normalized email as keys.

### Rate limiting

| Layer | When | Keys | Scope |
|-------|------|------|-------|
| Early hook | `onRequest`, before body parsing | `ip:<clientIp>`, optionally `user:<sub>` from Bearer JWT | All `/auth/*` |
| Controller | After Zod validation | `ip:<clientIp>`, `user:<normalizedEmail>` | `/auth/register`, `/auth/login` only |

Implementation: custom **fixed-window** limiter in `src/infrastructure/auth/rate-limiter.ts`. Defaults: 10 requests per 60 000 ms window (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`). Blocked requests return `429` with `Retry-After` header. `/health` is unaffected.

### HTTP error shape

All auth errors use a consistent JSON body:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid email or password",
  "code": "AUTH_INVALID_CREDENTIALS"
}
```

Mapping lives in `src/adapters/auth/map-auth-error.ts`. Domain errors never leak whether an email exists on login.

### Auth API contracts

Base URL: `http://localhost:3000` (default). All auth routes are `POST` with `Content-Type: application/json`.

#### `POST /auth/register`

Create a user and issue an initial token pair.

**Request**

```json
{
  "email": "alice@example.com",
  "name": "Alice",
  "password": "securePass1"
}
```

**Success — `201 Created`**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com",
    "name": "Alice"
  },
  "tokens": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "expiresIn": 900
  }
}
```

**Errors:** `400` validation / password rules (`VALIDATION_ERROR`, `AUTH_INVALID_PASSWORD`), `409` duplicate email (`AUTH_USER_ALREADY_EXISTS`), `429` rate limit.

#### `POST /auth/login`

**Request**

```json
{
  "email": "alice@example.com",
  "password": "securePass1"
}
```

**Success — `200 OK`**

Same shape as register success (`user` + `tokens`).

**Errors:** `400` validation, `401` invalid credentials (`AUTH_INVALID_CREDENTIALS` — same message for unknown user and wrong password), `429` rate limit.

#### `POST /auth/logout`

Revoke the presented refresh token if it is still `active`.

**Request**

```json
{
  "refreshToken": "<jwt>"
}
```

**Success — `204 No Content`** (empty body)

**Errors:** `400` validation, `401` invalid refresh token (`AUTH_INVALID_REFRESH_TOKEN`).

#### `POST /auth/refresh`

Rotate refresh token and issue a new access + refresh pair. The submitted refresh token is marked `rotated`; the new pair shares the same `family`.

**Request**

```json
{
  "refreshToken": "<jwt>"
}
```

**Success — `200 OK`**

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "expiresIn": 900
}
```

**Errors:** `400` validation, `401` invalid/expired/replayed refresh token (`AUTH_INVALID_REFRESH_TOKEN`). Reuse of a `rotated` token revokes the entire family.

#### Rate limit response — `429 Too Many Requests`

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

Response includes `Retry-After: <seconds>` header.

### Auth folder layout

```
src/
├── domain/auth/           # User, Password, AuthTokenClaims, domain errors
├── application/auth/      # register, login, logout, refresh use cases + DTOs
├── adapters/auth/         # Controller, error mapping
├── infrastructure/auth/   # JWT, Argon2, rate limiter, repositories
├── routes/auth.ts         # Fastify plugin for /auth/*
└── server.ts              # Early rate limit + route registration
```

## Folder Structure

src/
├── domain/          # Entities, business rules
├── application/     # Use cases, services
├── adapters/        # Controllers, repositories
├── infrastructure/  # DB, config, external
├── server.ts
└── routes/

## Non-Functional Requirements
- High security (no password enumeration, proper rate limiting, refresh replay detection)
- Good test coverage (>85%)
- ESM + strict TypeScript
- Easy local development with Docker Compose

## Known trade-offs

| Area | Current choice | Consequence |
|------|----------------|-------------|
| Refresh token store | In-memory (`createInMemoryRefreshTokenRepository`) | Rotation/revocation state is lost on process restart; not suitable for multi-instance production without replacement |
| Rate limiter store | In-process `Map` | Limits are per-instance, not shared across replicas |
| Fixed-window limiting | Simple counter per window | Possible burst at window boundaries; acceptable for MVP auth endpoints |