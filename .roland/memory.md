# Roland Project Memory

_Updated automatically after each run. Edit manually at any time._

## Architecture Decisions

- Used primary constructor injection (`class Foo(IBar bar)`) across all services and repositories for conciseness

## Coding Standards

- DI extension methods named `AddApplication`/`AddInfrastructure` registered in `Program.cs` via `builder.Services.AddX()`
- Integration-test factories are named `*EndpointWebApplicationFactory` and live in the same `.cs` file as their corresponding `*EndpointTests` class.

## Past Mistakes

- Tests directly instantiate `InMemoryUserRepository` instead of resolving through DI; root cause: no service-provider test fixture exists yet

## Preferences

- Repository and service methods consistently accept `CancellationToken` as the final parameter with `= default`

## Project Gotchas

- `InMemoryUserRepository` enforces unique email constraints at the in-memory level to mirror EF Core/SQL Server behavior
- SQLite `:memory:` databases vanish unless the `SqliteConnection` is kept open for the lifetime of the `WebApplicationFactory`; the factory therefore stores the connection as a field and calls `_connection.Open()` in its constructor.

## Proven Patterns

- Test doubles (`InMemoryUserRepository`) live in `Infrastructure` so both unit tests and future integration tests can share the same fake
- Co-locating a `*EndpointWebApplicationFactory : WebApplicationFactory<Program>` (with shared SQLite connection + `RemoveEfCoreRegistrations`) inside the same file as the test class enables fast, realistic HTTP integration tests that exercise the full DI pipeline, auth middleware, and real EF Core repositories.

## Anti-Patterns

- [×2] (none new this run)

---

_Last updated: 2026-05-29 · run mpq9vrue · Write HTTP integration tests for Project CRUD endpoints with_
