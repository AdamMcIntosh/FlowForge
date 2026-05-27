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
**Consequences:** Access token is not required on logout/refresh — refresh token in body is sufficient; protected resource routes will use Bearer access tokens (future work).

---

**How to add new decisions:**  
After a major architectural choice, ask Roland:
`roland team "Document the decision to use X in DECISIONS.md"`