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

## Tasks

Tasks belong to a **Project** and follow the same Clean Architecture layering as auth and projects. Domain rules live in `src/domain/task/`, use cases in `src/application/task/`, HTTP adapters in `src/adapters/task/`, and persistence in `src/infrastructure/task/`.

### Task model

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Server-generated on create |
| `title` | string | Required, 1–255 chars (trimmed) |
| `description` | string \| null | Optional, max 2000 chars; empty string → `null` |
| `status` | enum | `TODO` (default), `IN_PROGRESS`, `DONE` |
| `projectId` | string | Parent project; immutable after create |
| `assigneeId` | string \| null | Optional user reference; no assignee-based auth yet |
| `createdAt` / `updatedAt` | ISO datetime | Set by domain/repository |

Status values are defined in `src/domain/task/task-status.ts` and mirrored in the Prisma `TaskStatus` enum.

### Authorization model (project owner only)

All task routes require a valid **Bearer access token**. The controller injects `userId` from JWT `sub` only — it is never accepted from the request body.

| Operation | Authorization check |
|-----------|----------------------|
| Create / List | Load project by `projectId` → `project.assertOwnedBy(userId)` |
| Get / Update / Delete | Load task → load parent project → `task.assertAccessibleByProjectOwner(project.ownerId, userId)` |

**Only the project owner** may access tasks in that project. Assignees have no implicit read or write access in the current model. Non-owners receive `403` (`TASK_UNAUTHORIZED` or `PROJECT_OWNERSHIP`); missing project/task returns `404` (no existence leak across owners).

```
JWT preHandler → controller (userId from claims)
  → task use case
  → projectRepository.findById + ownership assert
  → taskRepository save | findByProjectId | findById | update | delete
  → sendMappedTaskError on failure
```

### HTTP error shape

Task errors use the same JSON envelope as auth:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "You do not have permission to access this task",
  "code": "TASK_UNAUTHORIZED"
}
```

Mapping lives in `src/adapters/task/map-task-error.ts`. Common codes: `VALIDATION_ERROR` (400), `TASK_NOT_FOUND` / `PROJECT_NOT_FOUND` (404), `TASK_UNAUTHORIZED` / `PROJECT_OWNERSHIP` (403), `TASK_INVALID_*` (422).

### Task API contracts

Base URL: `http://localhost:3000`. All routes require `Authorization: Bearer <accessToken>`.

#### `POST /projects/:id/tasks`

Create a task in a project the caller owns.

**Request**

```json
{
  "title": "Set up CI pipeline",
  "description": "GitHub Actions for test + lint",
  "status": "TODO",
  "assigneeId": "550e8400-e29b-41d4-a716-446655440001"
}
```

Only `title` is required. `status` defaults to `TODO`; `description` and `assigneeId` are optional (`assigneeId: null` clears assignment on update only).

**Success — `201 Created`**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "title": "Set up CI pipeline",
  "description": "GitHub Actions for test + lint",
  "status": "TODO",
  "projectId": "770e8400-e29b-41d4-a716-446655440000",
  "assigneeId": "550e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2025-05-27T12:00:00.000Z",
  "updatedAt": "2025-05-27T12:00:00.000Z"
}
```

**Errors:** `400` validation, `403` not project owner, `404` project not found, `422` domain validation.

#### `GET /projects/:id/tasks`

List tasks for an owned project, ordered by `updatedAt` descending.

**Success — `200 OK`**

```json
{
  "tasks": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "title": "Set up CI pipeline",
      "description": null,
      "status": "IN_PROGRESS",
      "projectId": "770e8400-e29b-41d4-a716-446655440000",
      "assigneeId": null,
      "createdAt": "2025-05-27T12:00:00.000Z",
      "updatedAt": "2025-05-27T14:30:00.000Z"
    }
  ]
}
```

#### `GET /tasks/:id`

Fetch a single task. Caller must own the task's parent project.

**Success — `200 OK`:** Same task object shape as create response.

**Errors:** `404` task or parent project not found, `403` not owner.

#### `PATCH /tasks/:id`

Partial update; at least one of `title`, `description`, `status`, or `assigneeId` must be provided.

**Request**

```json
{
  "status": "DONE",
  "assigneeId": null
}
```

**Success — `200 OK`:** Updated task object.

#### `DELETE /tasks/:id`

**Success — `204 No Content`** (empty body)

### Task folder layout

```
src/
├── domain/task/           # Task entity, TaskStatus, domain errors
├── application/task/      # create, list, get, update, delete use cases + DTOs
├── adapters/task/         # Controller, request/error mapping
├── infrastructure/task/   # PrismaTaskRepository
├── routes/tasks.ts        # Fastify plugin (JWT on all routes)
└── infrastructure/auth/   # jwt-auth-middleware (shared with /me, /projects)
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