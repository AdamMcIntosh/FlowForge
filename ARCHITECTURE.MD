# FlowForge Architecture

## Overview

FlowForge is a Task and Project management system built with **.NET 10** using **Clean Architecture**.

## Layered Structure

- **FlowForge.Domain** — Entities, Value Objects, Domain Events, Exceptions, Repository Interfaces
- **FlowForge.Application** — Use Cases, Services, DTOs, Business Logic
- **FlowForge.Infrastructure** — EF Core, Repositories, External Services, Persistence
- **FlowForge.Api** — Minimal API Endpoints, Middleware, Configuration, Program.cs

## Key Design Principles

- **Dependency Rule:** Outer layers depend on inner layers (never the reverse)
- **Domain Purity:** Domain contains no infrastructure or framework references
- **Explicit Contracts:** All dependencies are expressed through interfaces
- **Testability:** All layers are independently testable

## Technology Stack

- **Framework:** .NET 10 + ASP.NET Core
- **ORM:** Entity Framework Core 10 with SQL Server
- **Authentication:** JWT Bearer
- **Testing:** xUnit + FluentAssertions + WebApplicationFactory
- **API Style:** Minimal APIs

## Current State (May 2026)

- User domain model and repository complete
- Basic authentication (register / login) implemented
- Protected `/me` endpoint working
- Project domain, repositories, and ownership-authorized application use cases complete
- Task domain partially implemented
- Clean in-memory testing strategy in place

## Project ownership

Projects carry an immutable `OwnerId` (`UserId`) set at construction. Authorization is enforced in `ProjectService`:

- **Create** — caller's `UserId` becomes `OwnerId`
- **List** — repository query filtered by `OwnerId` (`GetAllByOwnerAsync`)
- **Get / update / delete** — load by id, then verify `project.OwnerId == ownerId`

Failures throw application exceptions consumed by the API layer:

| Exception | Meaning |
|-----------|---------|
| `ProjectNotFoundException` | Unknown project id |
| `UnauthorizedProjectAccessException` | Project exists but caller is not the owner |

List operations never return another user's projects. Get/update/delete against a foreign-owned id fail with `UnauthorizedProjectAccessException` rather than `ProjectNotFoundException`.

## Next Major Milestones

- Project HTTP endpoints (CRUD with JWT-derived `ownerId`)
- Complete Task domain and use cases
- Production-grade configuration and observability
- CI/CD pipeline
