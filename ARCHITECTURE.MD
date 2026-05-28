# FlowForge Architecture

## Overview
Modern Task & Project Management application with Fastify backend and React frontend.

## Layered Architecture (Clean Architecture)

- **Domain**: Entities, Value Objects, Domain Events, Business Rules
- **Application**: Use Cases, Services, DTOs
- **Adapters**: Controllers, Repositories, External Services
- **Infrastructure**: Database (Prisma), Config, Logging, Rate Limiting

### Dependency direction

Dependencies point **inward**: outer layers call inner layers; domain code never imports Fastify, Prisma, or Zod. Repository **interfaces** live in `src/infrastructure/*/types.ts` and are consumed by application use cases; concrete Prisma and in-memory adapters implement those interfaces and are wired at composition root (`buildServer()` in `server.ts`).

| Layer | Task CRUD responsibilities | Key paths |
|-------|------------------------------|-----------|
| **Domain** | `Task` aggregate, `TaskStatus`, domain errors, field validation | `src/domain/task/` |
| **Application** | Seven use cases, `task-access` guards, Zod DTOs, `toTaskResponse`, factory | `src/application/task/` |
| **Adapters** | HTTP controller, request/body Zod schemas, error mapping | `src/adapters/task/`, `src/routes/tasks.ts` |
| **Infrastructure** | `TaskRepository` + Prisma/in-memory impl, shared JWT middleware | `src/infrastructure/task/`, `src/infrastructure/auth/jwt-auth-middleware.ts` |

Task use cases depend only on `TaskRepository`, `ProjectRepository`, and domain types. `createTaskUseCasesFromInfrastructure()` in `server.ts` pairs `createPrismaTaskRepository(prisma)` with the shared project repository and passes the resulting `TaskUseCases` into `taskRoutes`.

## Key Design Decisions
- JWT Authentication with short-lived access + refresh tokens (RS256, unique `jti`, refresh rotation)
- Layered rate limiting on `/auth/*` (early per-IP hook + per-IP/per-email on register/login)
- Task CRUD scoped to project ownership — JWT-protected routes, no assignee-based authorization in MVP
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

## Task Management

Tasks belong to a **Project** and follow the same Clean Architecture layering as auth and projects. Domain rules live in `src/domain/task/`, use cases in `src/application/task/`, HTTP adapters in `src/adapters/task/`, and persistence in `src/infrastructure/task/`. All task routes are JWT-protected and reuse the shared RS256 access-token middleware from `src/infrastructure/auth/jwt-auth-middleware.ts`.

### HTTP route map

| Method | Path | Controller handler | Use case(s) | Success |
|--------|------|--------------------|-------------|---------|
| `POST` | `/projects/:id/tasks` | `create` | `create` | `201` + task object |
| `GET` | `/projects/:id/tasks` | `list` | `list` | `200` + `{ tasks: [...] }` |
| `GET` | `/tasks/:id` | `get` | `get` | `200` + task object |
| `PATCH` | `/tasks/:id` | `update` | `update`, `assign`, or `changeStatus` (see PATCH delegation) | `200` + task object |
| `DELETE` | `/tasks/:id` | `delete` | `delete` | `204` empty body |

Every route registers `preHandler: jwtAuth.preHandler` from `createJwtAuthMiddleware({ jwtService })` in `src/routes/tasks.ts`.

### Domain layer

#### `Task` entity and `TaskId`

`TaskId` is a typed string alias (`export type TaskId = string`). The `Task` class in `src/domain/task/task.ts` is an **immutable aggregate**: factory methods create instances; mutations return a new `Task` via `update()`. `projectId` is set at create time and never changes.

| Method | Purpose |
|--------|---------|
| `Task.create(input)` | New task with server-supplied `id`, validated fields, default status `TODO` |
| `Task.reconstitute(props)` | Hydrate from persistence (repository/Prisma) |
| `Task.update(input)` | Return new instance with changed fields and fresh `updatedAt` |
| `task.assertAccessibleByProjectOwner(ownerId, userId)` | Throw `UnauthorizedTaskAccessError` if caller is not project owner |
| `task.toProps()` | Serialize for repository persistence |

#### `TaskStatus` value object

Defined in `src/domain/task/task-status.ts`:

| Value | Meaning |
|-------|---------|
| `TODO` | Default on create |
| `IN_PROGRESS` | Work started |
| `DONE` | Completed |

`parseTaskStatus()` and `isTaskStatus()` validate at domain boundaries. Invalid values throw `InvalidTaskStatusError`. Values mirror the Prisma `TaskStatus` enum.

#### Domain errors

| Error | Code | HTTP (via adapter) |
|-------|------|--------------------|
| `TaskNotFoundError` | `TASK_NOT_FOUND` | 404 |
| `UnauthorizedTaskAccessError` | `TASK_UNAUTHORIZED` | 403 |
| `InvalidTaskTitleError` | `TASK_INVALID_TITLE` | 422 |
| `InvalidTaskDescriptionError` | `TASK_INVALID_DESCRIPTION` | 422 |
| `InvalidTaskStatusError` | `TASK_INVALID_STATUS` | 422 |

Project-scoped errors (`ProjectNotFoundError`, `ProjectOwnershipError`) from `src/domain/project/` are also mapped when authorization loads the parent project.

### Task model (persistence shape)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID (`TaskId`) | Server-generated via `randomUUID()` in create use case |
| `title` | string | Required, 1–255 chars (trimmed) |
| `description` | string \| null | Optional, max 2000 chars; empty string → `null` |
| `status` | `TaskStatusValue` | `TODO` (default), `IN_PROGRESS`, `DONE` |
| `projectId` | string | Parent project; immutable after create |
| `assigneeId` | string \| null | Optional user reference; stored but not used for authorization |
| `createdAt` / `updatedAt` | ISO datetime | Set by domain on create/update; serialized in responses |

#### Prisma schema and relations

The persistence model in `prisma/schema.prisma` mirrors the domain shape:

| Relation | Target | `onDelete` | Effect |
|----------|--------|------------|--------|
| `project` | `Project` | `Cascade` | Deleting a project removes all its tasks |
| `assignee` | `User?` | `SetNull` | Deleting a user clears `assigneeId` on assigned tasks |

Prisma types never cross into domain or application code. `createPrismaTaskRepository` is the sole translation boundary: records hydrate via `Task.reconstitute()`, writes use `task.toProps()`.

#### Status workflow

There is **no enforced state machine** in the MVP. Any valid `TaskStatusValue` (`TODO`, `IN_PROGRESS`, `DONE`) may be set on create or via `update` / `changeStatus`. Invalid enum strings fail at the Zod DTO boundary (HTTP `400`) or at `parseTaskStatus()` in the domain entity (`422` / `TASK_INVALID_STATUS`).

### Application layer

Seven use cases are composed by `createTaskUseCases()` in `src/application/task/create-task-use-cases.ts`. Each use case depends only on `TaskRepository`, `ProjectRepository`, and domain types — never on Fastify or Prisma.

| Use case | Input DTO (Zod) | Authorization helper |
|----------|-----------------|----------------------|
| `create` | `createTaskInputSchema` | `requireOwnedProject()` |
| `list` | `listTasksInputSchema` | `requireOwnedProject()` |
| `get` | `getTaskInputSchema` | `requireTaskAccessibleByProjectOwner()` |
| `update` | `updateTaskInputSchema` | `requireTaskAccessibleByProjectOwner()` |
| `assign` | `assignTaskInputSchema` | `requireTaskAccessibleByProjectOwner()` |
| `changeStatus` | `changeTaskStatusInputSchema` | `requireTaskAccessibleByProjectOwner()` |
| `delete` | `deleteTaskInputSchema` | `requireTaskAccessibleByProjectOwner()` |

Authorization is centralized in `src/application/task/task-access.ts`:

- **`requireOwnedProject()`** — used by create/list. Loads project by URL `projectId`, throws `ProjectNotFoundError` if missing, then `project.assertOwnedBy(userId)`.
- **`requireTaskAccessibleByProjectOwner()`** — used by get/update/delete/assign/changeStatus. Loads task by id, loads parent project, throws `TaskNotFoundError` if either is missing (no cross-owner existence leak), then `task.assertAccessibleByProjectOwner(project.ownerId, userId)`.

Responses are mapped through `toTaskResponse()` in `task-mapper.ts` to `TaskResponseDto` (ISO date strings, flat task object).

Production wiring: `createTaskUseCasesFromInfrastructure(taskRepository, projectRepository)` in `server.ts` pairs `createPrismaTaskRepository(prisma)` with the shared `ProjectRepository`.

#### Use-case behavior (internal steps)

Each use case is a factory (`createCreateTaskUseCase`, etc.) returning an async function. The factory wrapper in `createTaskUseCases()` re-parses every input with the matching Zod schema before dispatch.

| Use case | Authorization | Domain / persistence steps |
|----------|---------------|----------------------------|
| **create** | `requireOwnedProject` | `Task.create({ id: randomUUID(), ... })` → `taskRepository.save` → `toTaskResponse` |
| **list** | `requireOwnedProject` | `findByProjectId` (ordered `updatedAt` desc) → map each via `toTaskResponse` → `{ tasks }` |
| **get** | `requireTaskAccessibleByProjectOwner` | Return loaded task via `toTaskResponse` (read-only) |
| **update** | `requireTaskAccessibleByProjectOwner` | `task.update(partial fields)` → `taskRepository.update` → `toTaskResponse` |
| **assign** | `requireTaskAccessibleByProjectOwner` | `task.update({ assigneeId })` (`null` unassigns) → `taskRepository.update` |
| **changeStatus** | `requireTaskAccessibleByProjectOwner` | `task.update({ status })` → `taskRepository.update` |
| **delete** | `requireTaskAccessibleByProjectOwner` | `taskRepository.delete(taskId)` (no response body) |

Assign and changeStatus exist as dedicated use cases so the controller can route single-field `PATCH` bodies to focused logic while multi-field updates still flow through `update`.

### Repository layer

The `TaskRepository` interface lives in `src/infrastructure/task/types.ts` (infrastructure layer, following the Project/User pattern):

```typescript
interface TaskRepository {
  save(task: Task): Promise<Task>;
  findById(id: TaskId): Promise<Task | null>;
  findByProjectId(projectId: ProjectId): Promise<Task[]>;
  update(task: Task): Promise<Task>;
  delete(id: TaskId): Promise<void>;
}
```

| Implementation | Factory | Usage |
|----------------|---------|-------|
| Prisma adapter | `createPrismaTaskRepository(prisma)` | Production (`server.ts`) |
| In-memory adapter | `createInMemoryTaskRepository()` | Unit/integration tests |

`createPrismaTaskRepository` maps between Prisma records and domain entities via `Task.reconstitute()` / `task.toProps()`. `findByProjectId` orders by `updatedAt` descending. The domain layer never imports Prisma types.

| Method | Prisma operation | Notes |
|--------|------------------|-------|
| `save` | `task.create` | Used on create; persists full `toProps()` snapshot |
| `findById` | `task.findUnique` | Returns `null` when missing (use case maps to `TaskNotFoundError`) |
| `findByProjectId` | `task.findMany` + `orderBy: { updatedAt: 'desc' }` | List use case |
| `update` | `task.update` | Persists immutable `Task.update()` result |
| `delete` | `task.delete` | Hard delete; no soft-delete in MVP |

`createInMemoryTaskRepository()` mirrors the same interface with a `Map<TaskId, Task>` for unit and HTTP integration tests.

### Validation (Zod)

Validation happens at two boundaries:

1. **Application DTOs** (`src/application/task/dto/`) — full use-case inputs including `userId` and route ids. The factory re-parses with these schemas before invoking use cases.
2. **HTTP request schemas** (`src/adapters/task/map-task-request.ts`) — strip auth/context fields the controller injects:

| Schema | Source | Strips |
|--------|--------|--------|
| `createTaskBodySchema` | `createTaskInputSchema` | `userId`, `projectId` |
| `updateTaskBodySchema` | `updateTaskInputSchema` | `userId`, `taskId` |
| `projectIdParamSchema` | — | URL `:id` for project routes |
| `taskIdParamSchema` | — | URL `:id` for task routes |

`updateTaskBodySchema` requires at least one of `title`, `description`, `status`, or `assigneeId`.

### Integration with authentication

Every task route registers `createJwtAuthMiddleware({ jwtService }).preHandler` in `src/routes/tasks.ts`. The middleware:

1. Extracts `Bearer` token from `Authorization` header
2. Verifies RS256 access token via `jwtService.verifyAccessToken()`
3. Attaches claims to `request.accessTokenClaims`
4. Returns `401` with `AUTH_UNAUTHORIZED` on missing/invalid/expired tokens

The controller reads `userId` exclusively from `request.accessTokenClaims.sub` — never from the request body or query. Task routes do **not** register the auth rate limiter; only `/auth/*` paths are rate-limited (see below).

### Request flow

#### Project-scoped routes (`POST` / `GET /projects/:id/tasks`)

```
POST | GET /projects/:id/tasks
  → jwtAuth.preHandler (verify access token, attach claims)
  → taskRoutes → createTaskController
  → Zod parse (projectIdParamSchema + createTaskBodySchema | list has params only)
  → userId from accessTokenClaims.sub
  → taskUseCases.create | list
  → requireOwnedProject(projectRepository, projectId, userId)
  → taskRepository.save | findByProjectId
  → sendMappedTaskError on failure
```

#### Task-scoped routes (`GET` / `PATCH` / `DELETE /tasks/:id`)

```
GET | PATCH | DELETE /tasks/:id
  → jwtAuth.preHandler
  → taskRoutes → createTaskController
  → Zod parse (taskIdParamSchema + updateTaskBodySchema for PATCH)
  → userId from accessTokenClaims.sub
  → taskUseCases.get | update | assign | changeStatus | delete
  → requireTaskAccessibleByProjectOwner(taskRepository, projectRepository, taskId, userId)
  → taskRepository findById | update | delete
  → sendMappedTaskError on failure
```

#### PATCH delegation (assign / change status)

When `PATCH /tasks/:id` receives a body with **exactly one** field, the controller routes to focused use cases:

| Body | Use case |
|------|----------|
| `{ "assigneeId": "<uuid>" }` or `{ "assigneeId": null }` | `assign` |
| `{ "status": "IN_PROGRESS" }` | `changeStatus` |
| Any other combination (multi-field or title/description) | `update` |

This keeps assign and status-change logic in dedicated use cases while exposing a single REST update endpoint.

#### End-to-end create flow

```
Client POST /projects/:id/tasks + Bearer token
  → jwtAuth.preHandler          (401 if token missing/invalid)
  → projectIdParamSchema.parse    (400 if :id missing)
  → createTaskBodySchema.parse    (400 if body invalid)
  → userId = accessTokenClaims.sub
  → createTaskInputSchema.parse   (application boundary)
  → requireOwnedProject           (404 project, 403 not owner)
  → Task.create + randomUUID()
  → taskRepository.save
  → toTaskResponse → 201 JSON
```

Errors at any step are caught by the controller and mapped through `sendMappedTaskError()` → `mapTaskError()`.

### Rate limiting

Task routes are **not** rate-limited. The fixed-window limiter applies only to `/auth/*` (early hook in `server.ts` plus per-email checks on register/login). Protected task endpoints rely on JWT validation and project-ownership checks for access control. If task endpoints need throttling in production, a separate limiter keyed by `userId` or IP would be added at the route or global hook level.

### Authorization model (project owner only)

| Operation | Who may access | Check |
|-----------|----------------|-------|
| Create / List | Project owner only | `requireOwnedProject()` |
| Get / Update / Delete / Assign / Change status | Project owner only | `requireTaskAccessibleByProjectOwner()` |

**Only the project owner** may access tasks in that project. Assignees have no implicit read or write access in the current model. Non-owners receive `403` (`TASK_UNAUTHORIZED` or `PROJECT_OWNERSHIP`); missing project/task returns `404`.

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

Mapping lives in `src/adapters/task/map-task-error.ts` and is sent via `sendMappedTaskError()`. Common codes: `VALIDATION_ERROR` (400), `TASK_NOT_FOUND` / `PROJECT_NOT_FOUND` (404), `TASK_UNAUTHORIZED` / `PROJECT_OWNERSHIP` (403), `TASK_INVALID_*` (422), `AUTH_UNAUTHORIZED` (401 from JWT middleware).

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

Only `title` is required. `status` defaults to `TODO`; `description` and `assigneeId` are optional.

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

**Errors:** `400` validation, `401` missing/invalid token, `403` not project owner, `404` project not found, `422` domain validation.

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

**Errors:** `401` unauthorized, `404` task or parent project not found, `403` not owner.

#### `PATCH /tasks/:id`

Partial update; at least one of `title`, `description`, `status`, or `assigneeId` must be provided.

**Assign only**

```json
{
  "assigneeId": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Change status only**

```json
{
  "status": "DONE"
}
```

**Multi-field update**

```json
{
  "title": "Deploy to staging",
  "status": "IN_PROGRESS",
  "assigneeId": null
}
```

**Success — `200 OK`:** Updated task object.

**Errors:** `400` validation (empty body), `401` unauthorized, `403` not owner, `404` not found, `422` domain validation.

#### `DELETE /tasks/:id`

**Success — `204 No Content`** (empty body)

**Errors:** `401` unauthorized, `403` not owner, `404` not found.

#### Unauthorized — `401` (missing or invalid JWT)

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Missing or invalid access token",
  "code": "AUTH_UNAUTHORIZED"
}
```

### Task folder layout

```
src/
├── domain/task/              # Task entity, TaskId, TaskStatus, domain errors
├── application/task/         # 7 use cases, task-access, DTOs, task-mapper, factory
├── adapters/task/            # Controller, map-task-request, map-task-error, send-task-error
├── infrastructure/task/      # TaskRepository interface, Prisma + in-memory implementations
├── infrastructure/auth/      # jwt-auth-middleware (shared with /me, /projects)
├── routes/tasks.ts           # Fastify plugin — JWT preHandler on all routes
└── server.ts                 # createTaskUseCasesFromInfrastructure + route registration
```

### Testing strategy

| Layer | Test location | Setup |
|-------|---------------|-------|
| Domain | `src/domain/task/*.test.ts` | Pure unit tests, no I/O |
| Application | `src/application/task/*.test.ts` | In-memory repos via `tests/helpers/task-use-case-fixtures.ts` |
| Adapters | `src/adapters/task/task-controller.test.ts` | Mocked `TaskUseCases` |
| HTTP integration | `tests/tasks.integration.test.ts`, `tests/tasks-authz-matrix.integration.test.ts` | `createTaskIntegrationTestApp()` (`tests/helpers/create-task-integration-test-app.ts`) with in-memory repos |
| Prisma repository | `src/infrastructure/task/*.test.ts`, `tests/task-repository.integration.test.ts` | Mocked Prisma (unit) or per-test SQLite via `createPrismaTestContext()` (integration) |

The full Task test matrix runs without PostgreSQL or Docker.

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
| Task assignee | Stored on entity, not used for auth | Assignees cannot read or mutate tasks unless they own the parent project |
| Task status transitions | No domain state machine | Any status may transition to any other; rules can be added in `Task.update()` later |
| Task endpoints | No rate limiting | Relies on JWT + project ownership; separate limiter needed for abuse protection at scale |