# FlowForge Technology Stack

## Core Framework
- **.NET Version**: .NET 10 (latest)
- **Web Framework**: ASP.NET Core 10 with Minimal APIs
- **ORM**: Entity Framework Core 10
- **Database**: SQLite file (`flowforge.db`) for dev/local; SQL Server for production; SQLite in-memory for tests

## Architecture & Patterns
- **Architecture Style**: Clean Architecture (Domain → Application → Infrastructure → API)
- **Dependency Injection**: Built-in `IServiceCollection` with layer-specific extension methods
- **Authentication**: JWT Bearer tokens with unique `jti` claim
- **Password Hashing**: PBKDF2-SHA256

## Testing
- **Framework**: xUnit
- **Assertions**: FluentAssertions
- **Integration Testing**: `WebApplicationFactory<T>` + SQLite in-memory
- **Test Strategy**: In-memory repositories for speed, EF Core for realism

## Project Structure
- `src/FlowForge.Domain` — Entities, Value Objects, Repository Interfaces
- `src/FlowForge.Application` — Use Cases, Services, DTOs
- `src/FlowForge.Infrastructure` — EF Core Repositories, Persistence, External Services
- `src/FlowForge.Api` — Minimal API Endpoints, Middleware, Program.cs
- `tests/FlowForge.Tests` — Unit and Integration Tests

## Key Conventions
- Value Objects for identities and critical primitives (`UserId`, `Email`, etc.)
- Repository interfaces defined in Domain layer
- Primary constructor injection preferred
- All async methods accept `CancellationToken` with `= default`
- Endpoints organized in `Endpoints/{Domain}Endpoints.cs` files
- Integration tests use `create*IntegrationTestApp()` helpers

## Tooling
- Build: `dotnet build`
- Test: `dotnet test`
- EF Migrations: `dotnet ef migrations add` / `dotnet ef database update`
- Solution Format: `.slnx` (modern .NET solution file)

Last Updated: May 2026
