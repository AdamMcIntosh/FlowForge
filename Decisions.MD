# Architectural Decisions (FlowForge)

This document records key architectural and technical decisions for the FlowForge project.

## Core Architecture

**Decision:** Adopt Clean Architecture (Domain → Application → Infrastructure → API)
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Enforces dependency direction, improves testability, and maintains clear separation of concerns.
- **Consequences:** Domain remains pure; Infrastructure handles EF Core and external concerns.

**Decision:** Use Minimal APIs instead of Controllers
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Lightweight, explicit, and aligns with modern ASP.NET Core recommendations for smaller APIs.
- **Consequences:** Endpoints live in `Endpoints/` folder with extension methods.

## Domain Layer

**Decision:** Use Value Objects for identities and critical primitives (UserId, Email, etc.)
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Prevents primitive obsession and encapsulates validation rules.
- **Consequences:** Stronger type safety and better domain expressiveness.

**Decision:** Repository interfaces defined in Domain layer
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Keeps Domain independent of persistence details while declaring required contracts.

## Infrastructure & Persistence

**Decision:** Dual repository strategy (EF Core + InMemory implementations)
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Enables fast, reliable integration tests without external dependencies while maintaining production EF Core path.
- **Consequences:** Tests use SQLite in-memory; production uses SQL Server.

**Decision:** EF Core configurations discovered via assembly scanning
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Reduces boilerplate when adding new entities.

## Authentication & Security

**Decision:** JWT Bearer with unique `jti` claim
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Prevents replay attacks and supports future token revocation.
- **Consequences:** Every access token must include a unique GUID `jti`.

**Decision:** Authorization enforced at use-case layer via dedicated guards
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Keeps business rules close to the domain and avoids duplication.

## Testing Strategy

**Decision:** In-memory SQLite for most integration tests
- **Date:** May 2025
- **Status:** Accepted
- **Rationale:** Fast feedback loop and no external service dependency during development.
- **Consequences:** Production uses real SQL Server; tests remain isolated.
