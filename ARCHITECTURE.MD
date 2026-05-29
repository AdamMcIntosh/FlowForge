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

## Current State (May 2025)

- User domain model and repository complete
- Basic authentication (register / login) implemented
- Protected `/me` endpoint working
- Task domain partially implemented
- Clean in-memory testing strategy in place

## Next Major Milestones

- Complete Task domain and use cases
- Full Project + Task CRUD with ownership
- Production-grade configuration and observability
- CI/CD pipeline
