# FlowForge Architecture Decisions (ADRs)

This file records major decisions made during development.

## Decision Log

### 2025-05-27: Project Initialization
**Status:** Accepted  
**Context:** Starting a new Task/Project Management application.  
**Decision:** Use Clean Architecture (Domain → Application → Adapters → Infrastructure) with Fastify + TypeScript.  
**Rationale:** Promotes long-term maintainability and testability.  
**Consequences:** More boilerplate initially, but clearer separation of concerns.

### 2025-05-27: Database Choice
**Status:** Accepted  
**Context:** Need reliable relational data for users, tasks, projects.  
**Decision:** PostgreSQL with Prisma ORM.  
**Rationale:** Excellent TypeScript support, migrations, and developer experience.  
**Consequences:** Prisma-specific patterns will be used across the codebase.

### 2025-05-27: Authentication Strategy
**Status:** Accepted  
**Context:** Need secure user sessions.  
**Decision:** JWT with short-lived access tokens + refresh tokens (RS256).  
**Rationale:** Stateless, scalable, and widely supported.  
**Consequences:** Must handle token rotation securely and implement proper logout.

### 2025-05-27: JWT Signing Algorithm (RS256)
**Status:** Accepted  
**Context:** Access and refresh tokens must be verifiable without exposing signing secrets to all services.  
**Decision:** Sign JWTs with RS256 using PEM key pair from `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`.  
**Rationale:** Asymmetric keys allow future resource servers to verify access tokens with the public key only. RS256 is widely supported and avoids shared symmetric secrets.  
**Consequences:** Operators must generate and rotate key pairs; PEM newlines are stored as `\n` in env vars and normalized in config.

### 2025-05-27: JWT Claims and Unique jti
**Status:** Accepted  
**Context:** Tokens need stable identity for revocation, rotation, and audit without server-side sessions for access tokens.  
**Decision:** Every token includes a unique UUID `jti`. Access tokens carry `sub`, `email`, `type: "access"`. Refresh tokens carry `sub`, `family`, `type: "refresh"`. Claims are defined in `src/domain/auth/auth-token-claims.ts` and enforced on verify.  
**Rationale:** `jti` enables per-token refresh tracking; typed claims prevent cross-token misuse.  
**Consequences:** Issuance must always generate fresh `jti` values; refresh repository keys records by `jti`.

### 2025-05-27: Refresh Token Rotation with Family Replay Detection
**Status:** Accepted  
**Context:** Stolen refresh tokens must be detectable; logout must invalidate ongoing refresh chains.  
**Decision:** On refresh, mark the presented token `rotated` and issue a new pair in the same `family`. If a `rotated` token is presented again, revoke the entire family and reject the request. Logout marks an `active` token `revoked`.  
**Rationale:** Rotation limits refresh token lifetime exposure; family revocation catches replay of stolen tokens after legitimate rotation.  
**Consequences:** Refresh state must be persisted server-side (currently in-memory; see ADR below). Clients must replace stored refresh tokens on every refresh response.

### 2025-05-27: In-Memory Refresh Token Repository (MVP)
**Status:** Accepted (interim)  
**Context:** Refresh rotation requires server-side token state before a Prisma model exists.  
**Decision:** Use `createInMemoryRefreshTokenRepository()` for refresh token records and family revocation flags.  
**Rationale:** Unblocks full auth flow and tests without a schema migration; interface (`RefreshTokenRepository`) allows swap to PostgreSQL later.  
**Consequences:** Revocation/rotation state is lost on restart; horizontal scaling requires a shared store replacement. Document as technical debt before production.

### 2025-05-27: Password Hashing (Argon2id)
**Status:** Accepted  
**Context:** User passwords must resist offline cracking if the database is compromised.  
**Decision:** Hash passwords with Argon2id via the `argon2` package; domain `Password` value object validates plaintext rules before hashing.  
**Rationale:** Argon2id is the recommended password hashing algorithm (memory-hard, side-channel resistant variant).  
**Consequences:** Hash verification is async; registration/login depend on `PasswordHasher` interface for test doubles.

### 2025-05-27: No Credential Enumeration
**Status:** Accepted  
**Context:** Login and registration endpoints are public and rate-limited but still observable.  
**Decision:** Unknown email and wrong password both throw `InvalidCredentialsError` with message `"Invalid email or password"` and code `AUTH_INVALID_CREDENTIALS` → HTTP `401`. Registration conflicts use a distinct `409` (`AUTH_USER_ALREADY_EXISTS`) since the client supplied the email.  
**Rationale:** Prevents attackers from using login responses to discover valid accounts.  
**Consequences:** Clients cannot distinguish "no account" from "wrong password" on login; UX should use generic copy.

### 2025-05-27: Validation Library
**Status:** Accepted  
**Context:** Input validation for all endpoints.  
**Decision:** Use Zod for all request validation.  
**Rationale:** Excellent TypeScript integration and schema composition.  
**Consequences:** All DTOs will be defined as Zod schemas.

### 2025-05-27: Rate Limiting Strategy
**Status:** Accepted  
**Context:** Protect public endpoints from abuse.  
**Decision:** Custom fixed-window rate limiter applied early (before body parsing).  
**Rationale:** Consistent with security best practices and prevents unnecessary processing.  
**Consequences:** See layered auth rate limiting ADR below.

### 2025-05-27: Layered Auth Rate Limiting
**Status:** Accepted  
**Context:** `/auth/*` endpoints are brute-force targets; expensive body parsing and Argon2 verification should be skipped when possible.  
**Decision:** Two layers on auth routes:
1. **Early hook** (`registerEarlyRateLimit` on `onRequest`): checks `ip:<clientIp>` and optionally `user:<sub>` from Bearer JWT before body parse for all `/auth/*` paths.
2. **Controller hook** (register/login only): after Zod validation, checks `ip:<clientIp>` and `user:<normalizedEmail>`.  
Defaults: 10 requests / 60 s (`RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS`). Blocked responses: `429` + `Retry-After`.  
**Rationale:** Early rejection stops malformed or flood traffic cheaply; email-keyed limits throttle credential stuffing per target account.  
**Consequences:** In-process store means limits are per server instance; fixed-window may allow boundary bursts; `/health` and non-auth routes are unaffected.

### 2025-05-27: Auth HTTP Error Contract
**Status:** Accepted  
**Context:** Clients and integration tests need predictable error shapes across all four auth endpoints.  
**Decision:** Map domain/Zod errors through `mapAuthError` → `sendAuthHttpError` with shape `{ statusCode, error, message, code? }`. Validation → `400` / `VALIDATION_ERROR`; credentials → `401`; duplicate user → `409`; refresh failures → `401` / `AUTH_INVALID_REFRESH_TOKEN`.  
**Rationale:** Single mapping layer keeps controllers thin and guarantees consistent security messaging.  
**Consequences:** New domain errors must be added to `map-auth-error.ts` explicitly or fall through to `500`.

### 2025-05-27: Auth Endpoint Contracts
**Status:** Accepted  
**Context:** Frontend and API consumers need stable request/response contracts.  
**Decision:** Four `POST` JSON endpoints under `/auth`:

| Endpoint | Success | Body |
|----------|---------|------|
| `/auth/register` | `201` | `{ user, tokens }` |
| `/auth/login` | `200` | `{ user, tokens }` |
| `/auth/logout` | `204` | (empty) |
| `/auth/refresh` | `200` | `{ accessToken, refreshToken, expiresIn }` |

Input schemas: `registerInputSchema` (email, name, password with letter+number rules), `loginInputSchema`, `logoutInputSchema`, `refreshInputSchema` (refresh token string).  
**Rationale:** RESTful verbs via POST for credential-bearing bodies; token responses separate user profile from secrets.  
**Consequences:** Access token is not required on logout/refresh — refresh token in body is sufficient; protected resource routes use Bearer access tokens via `createJwtAuthMiddleware`.

### 2025-05-27: Task Authorization via Project Ownership
**Status:** Accepted  
**Context:** Tasks belong to projects; multiple users may exist but only project owners should manage task data in MVP.  
**Decision:** Enforce **owner-only** access for all task CRUD operations. Create/list check `project.assertOwnedBy(userId)`; get/update/delete load the parent project and call `task.assertAccessibleByProjectOwner(project.ownerId, userId)`. `userId` always comes from JWT `sub`, never from the request body.  
**Rationale:** Reuses the existing project ownership model; keeps authorization logic in use cases and domain entities rather than route-only checks.  
**Consequences:** Assignees can be stored on a task but cannot access it unless they also own the project. Future role-based access (assignee read, team members) requires new domain rules and ADRs.

### 2025-05-27: Task Status Enum
**Status:** Accepted  
**Context:** Tasks need a simple lifecycle for kanban-style workflows without over-modeling states.  
**Decision:** Three statuses only: `TODO`, `IN_PROGRESS`, `DONE`. Defined in `src/domain/task/task-status.ts`, validated by `parseTaskStatus`, mirrored in Prisma `TaskStatus`, and exposed in Zod DTOs. Default on create: `TODO`.  
**Rationale:** Aligns domain, API, and database; easy to extend later with explicit migration if new states are needed.  
**Consequences:** Clients must send exact enum strings; invalid values return `422` / `TASK_INVALID_STATUS`. No enforced transition rules (e.g. DONE → TODO is allowed at the domain layer).

### 2025-05-27: Task API Route Shape
**Status:** Accepted  
**Context:** Tasks are always scoped to a project for create/list, but clients need direct access by task id for detail views and edits.  
**Decision:** Nested routes for collection operations, flat routes for instance operations:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/projects/:id/tasks` | Create in project |
| `GET` | `/projects/:id/tasks` | List by project |
| `GET` | `/tasks/:id` | Get one |
| `PATCH` | `/tasks/:id` | Partial update |
| `DELETE` | `/tasks/:id` | Delete |

All routes register JWT `preHandler` in `src/routes/tasks.ts`.  
**Rationale:** RESTful nesting where the parent is natural (project context); flat paths avoid redundant project id on single-task mutations when the task id is already known.  
**Consequences:** Get/update/delete must resolve authorization via the task's stored `projectId`, not a URL project segment.

### 2025-05-27: Optional Task Assignee (No Membership Validation)
**Status:** Accepted (interim)  
**Context:** Tasks support an optional `assigneeId` for future UX, but there is no project membership or team model yet.  
**Decision:** Accept optional `assigneeId` (nullable) on create/update without verifying that the user exists or belongs to the project. Assignees receive **no** API access based on assignment alone.  
**Rationale:** Unblocks assignment UI and data model without building teams/invitations. Owner-only auth remains the single gate.  
**Consequences:** Orphan or arbitrary user ids may be stored; clients should validate assignees in UI until a membership ADR exists. Authorization gaps for assignees are intentional until roles are defined.

### 2025-05-28: Task Domain & Access Control (Consolidated Design)
**Status:** Accepted  
**Context:** Task CRUD spans domain, application, infrastructure, and HTTP layers. Downstream agents need a single reference for entity shape, authorization boundaries, and extension points.

#### Domain entity (`src/domain/task/task.ts`)
Immutable aggregate rooted in a **Project**. Factory methods: `Task.create()` (new), `Task.reconstitute()` (from persistence). Mutations return a new instance via `update()` — `projectId` is never changed after create.

| Field | Constraints |
|-------|-------------|
| `title` | Required, trimmed, 1–255 chars |
| `description` | Optional, max 2000 chars; blank → `null` |
| `status` | `TaskStatusValue`; default `TODO` |
| `projectId` | Required, immutable |
| `assigneeId` | Optional `UserId \| null` |
| `createdAt` / `updatedAt` | Set on create; `updatedAt` refreshed on `update()` |

Domain guards: `isInProject()` / `assertInProject(projectId)` for URL/body consistency; `assertAccessibleByProjectOwner(projectOwnerId, userId)` for auth.

#### Value objects (`src/domain/task/task-status.ts`)
`TaskStatus` enum: `TODO` | `IN_PROGRESS` | `DONE`. Parsed via `parseTaskStatus()` / `isTaskStatus()`; invalid values throw `InvalidTaskStatusError`. Mirrored in Prisma `TaskStatus` and Zod DTOs.

#### Status transitions
**No enforced state machine.** Any valid enum may be set from any other (e.g. `DONE → TODO`). `changeStatus` use case and general `update` both call `task.update({ status })`. Transition rules can be added later in the domain without changing repository contracts.

#### Project association
Every task carries exactly one `projectId`. Create/list operations receive `projectId` from the URL; get/update/delete/assign/changeStatus resolve the parent project via `task.projectId`. If the parent project is missing, callers receive `TaskNotFoundError` (404) — not a cross-owner leak.

#### Assignment rules
- Optional on create (`assigneeId` omitted → `null`).
- Set, reassign, or clear (`null`) via `assign` use case or `PATCH /tasks/:id`.
- **No validation** that assignee exists or belongs to the project (no membership model).
- **Assignee identity grants zero API access** in MVP; only project ownership does.

#### Authorization boundary
**MVP: project-owner only** (not project members — no membership table exists yet).

Centralized in `src/application/task/task-access.ts`:

| Helper | Used by | Check |
|--------|---------|-------|
| `requireOwnedProject()` | create, list | `projectRepository.findById` → `project.assertOwnedBy(userId)` |
| `requireTaskAccessibleByProjectOwner()` | get, update, delete, assign, changeStatus | load task → load parent project → `task.assertAccessibleByProjectOwner(project.ownerId, userId)` |

`userId` always comes from JWT `sub` (controller); never from request body. HTTP layer applies JWT `preHandler` only — no route-level ownership logic.

**Future extension (requires new ADR):** project membership / roles would replace or augment `assertAccessibleByProjectOwner` with something like `assertAccessibleByProjectMember(project, userId, role)`. Assignee read-only access would be a separate rule, not implied by `assigneeId`.

#### Repository interface (`src/infrastructure/task/types.ts`)
```ts
interface TaskRepository {
  save(task: Task): Promise<Task>;
  findById(id: TaskId): Promise<Task | null>;
  findByProjectId(projectId: ProjectId): Promise<Task[]>;
  update(task: Task): Promise<Task>;
  delete(id: TaskId): Promise<void>;
}
```
Implementations: `createPrismaTaskRepository()` (production), `createInMemoryTaskRepository()` (tests). Interface lives in infrastructure (follows Project/User pattern); domain depends on the `Task` entity only.

#### Domain errors (`src/domain/task/errors.ts`)
| Error | Code | Typical HTTP |
|-------|------|--------------|
| `TaskNotFoundError` | `TASK_NOT_FOUND` | 404 |
| `UnauthorizedTaskAccessError` | `TASK_UNAUTHORIZED` | 403 |
| `InvalidTaskTitleError` | `TASK_INVALID_TITLE` | 422 |
| `InvalidTaskDescriptionError` | `TASK_INVALID_DESCRIPTION` | 422 |
| `InvalidTaskStatusError` | `TASK_INVALID_STATUS` | 422 |

Related project errors (`ProjectNotFoundError`, `UnauthorizedProjectAccessError`) surface from `requireOwnedProject`. Mapped in `src/adapters/task/map-task-error.ts`.

#### Application & HTTP surface
Seven use cases via `createTaskUseCases()`: create, list, get, update, delete, assign, changeStatus. Controller routes single-field `PATCH` bodies to focused use cases (`assigneeId` only → assign; `status` only → changeStatus; otherwise → update).

### 2025-05-28: Task CRUD Feature Complete
**Status:** Accepted  
**Summary:** Task CRUD is fully implemented with project association, optional user assignment, a three-value status enum, and project-owner authorization enforced via JWT `sub` plus `requireOwnedProject` / `requireTaskAccessibleByProjectOwner` in the application layer.  
**Context:** The team goal was end-to-end Task management: create, read, list, update, delete, assign, and change-status — scoped to projects and gated so users may only access tasks in projects they own.  
**Decision:** Ship Task CRUD as complete across all layers:

| Layer | Deliverable |
|-------|-------------|
| Domain | Immutable `Task` entity, `TaskStatus` (`TODO` \| `IN_PROGRESS` \| `DONE`), domain errors |
| Application | Seven use cases (`create`, `list`, `get`, `update`, `delete`, `assign`, `changeStatus`) with Zod DTOs and centralized auth in `task-access.ts` |
| Infrastructure | `TaskRepository` interface, Prisma + in-memory implementations |
| Adapters / HTTP | JWT-protected routes in `src/routes/tasks.ts`; controller maps errors via `map-task-error.ts` |

**Authorization model:** Every task operation derives `userId` from the JWT access token `sub` (never from the request body). Create and list call `requireOwnedProject()`; get, update, delete, assign, and change-status call `requireTaskAccessibleByProjectOwner()` — both resolve the parent project and assert the authenticated user is its owner.  
**Rationale:** Reuses the established Project ownership model; keeps authorization in use cases rather than route-only checks; aligns with prior Task ADRs (`2025-05-27` and `2025-05-28: Task Domain & Access Control`).  
**Consequences:** Assignees stored on a task have no API access unless they also own the project. Role-based or assignee-scoped access requires a future ADR. Test suite (domain, application, repository, HTTP integration) runs without PostgreSQL via in-memory repositories.

### 2025-05-28: Task CRUD Clean Architecture Implementation
**Status:** Accepted  
**Context:** Task management requires create, read, list, update, delete, assign, and change-status operations scoped to projects, with input validation, persistence, and JWT-gated HTTP access. The team needed a consistent pattern matching auth and project features without leaking Fastify or Prisma into domain logic.  
**Decision:** Implement Task CRUD across four Clean Architecture layers with explicit boundaries:

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Domain | `src/domain/task/` | Immutable `Task` entity, `TaskStatus` value object, domain errors; no framework imports |
| Application | `src/application/task/` | Seven use cases via `createTaskUseCases()`, Zod DTOs, centralized authorization in `task-access.ts` |
| Adapters | `src/adapters/task/`, `src/routes/tasks.ts` | HTTP controller, request/error mappers, JWT-protected Fastify routes |
| Infrastructure | `src/infrastructure/task/` | `TaskRepository` interface, `createPrismaTaskRepository()` (production), `createInMemoryTaskRepository()` (tests) |

Additional implementation rules:
1. **Prisma repository pattern** — `TaskRepository` interface in `src/infrastructure/task/types.ts`; Prisma adapter maps records via `Task.reconstitute()` / `task.toProps()`; domain never imports Prisma types.
2. **Zod validation** — Application DTOs (`createTaskInputSchema`, etc.) parsed in the use-case factory; HTTP body/param schemas in `map-task-request.ts` strip auth context fields the controller injects from JWT claims.
3. **Auth-protected routes** — Every task route in `src/routes/tasks.ts` registers `createJwtAuthMiddleware({ jwtService }).preHandler`; `userId` is taken exclusively from `accessTokenClaims.sub`, never from the request body.

Production wiring in `server.ts`: `createTaskUseCasesFromInfrastructure(createPrismaTaskRepository(prisma), projectRepository)`.  
**Rationale:** Mirrors the established auth and project stack; keeps authorization in application use cases (not route-only checks); Zod at both HTTP and use-case boundaries catches invalid input early; repository interface enables in-memory doubles so the full test matrix runs without PostgreSQL.  
**Consequences:** New task features must follow the same layer boundaries — domain rules in entities, auth in `task-access.ts`, persistence changes only in infrastructure adapters. Adding Prisma fields requires domain entity + mapper updates. HTTP schemas and application DTOs must stay in sync manually. Task routes are not rate-limited (unlike `/auth/*`); throttling would require a separate ADR.

### 2025-05-28: Task CRUD — Authorization, Validation, and Persistence
**Status:** Accepted  
**Context:** Task CRUD is implemented across domain, application, infrastructure, and HTTP layers (create, list, get, update, delete, assign, changeStatus). Prior ADRs defined route shape, status enum, and domain design; this record captures the integrated implementation choices for authorization scope, input validation, and data access that govern the shipped feature.  
**Decision:**

1. **Project-owner authorization scoping** — Every task operation authorizes through the parent **project**, not through task-level roles or assignee identity. Create and list call `requireOwnedProject()` (`projectRepository.findById` → `project.assertOwnedBy(userId)`). Get, update, delete, assign, and changeStatus call `requireTaskAccessibleByProjectOwner()` (load task → load parent project → `task.assertAccessibleByProjectOwner(project.ownerId, userId)`). The authenticated user id is taken exclusively from JWT access-token `sub` in the controller; it is never accepted from the request body.

2. **No assignee authorization in MVP** — `assigneeId` is optional persistence metadata for future UX. Assignees receive **zero** API access based on assignment alone — they cannot read or mutate a task unless they also own the parent project. The API does not validate that an assignee user exists or belongs to the project (no membership model). This is intentional; see `2025-05-27: Optional Task Assignee (No Membership Validation)`.

3. **Zod validation at two boundaries** — Application DTOs in `src/application/task/dto/` define the canonical input schemas (including `userId`, `projectId`, and `taskId` where required). HTTP adapters in `src/adapters/task/map-task-request.ts` derive client-facing schemas by `.omit()`-ing auth and route context fields so callers cannot spoof identity or parent scope. Use-case factories parse application DTOs; controllers parse HTTP schemas first, then inject `userId` from token claims before invoking use cases. Domain entities enforce invariants (title length, status enum) independently of Zod.

4. **Repository pattern with swappable implementations** — Persistence is accessed only through `TaskRepository` in `src/infrastructure/task/types.ts` (`save`, `findById`, `findByProjectId`, `update`, `delete`). Production uses `createPrismaTaskRepository(prisma)` with `Task.reconstitute()` / `task.toProps()` mapping; tests use `createInMemoryTaskRepository()` so the full domain, application, and HTTP integration matrix runs without PostgreSQL. The interface follows the same location and naming convention as `ProjectRepository` and `UserRepository`.

**Rationale:** Reuses the established project-ownership gate without prematurely building teams, invitations, or role matrices. Dual Zod layers keep DTOs as the single validation source while preventing clients from supplying trusted auth context. The repository interface isolates Prisma from domain/application code and enables fast, isolated test doubles — consistent with auth and project features.  
**Consequences:** Assignee-facing workflows require either project ownership or a future ADR for membership/role-based access. Adding or renaming task fields requires coordinated updates to domain entity, Prisma schema, repository mapper, application DTOs, and HTTP request schemas. Authorization changes must go through `task-access.ts`, not ad hoc route checks. Invalid cross-owner access returns `403` (`TASK_UNAUTHORIZED`); missing task or project returns `404` (`TASK_NOT_FOUND`) to avoid leaking existence across owners.

---

**How to add new decisions:**  
After a major architectural choice, ask Roland:
`roland team "Document the decision to use X in DECISIONS.md"`