# Roland Project Memory

_Updated automatically after each run. Edit manually at any time._

## Architecture Decisions

- Used primary constructor injection (`class Foo(IBar bar)`) across all services and repositories for conciseness

## Coding Standards

- DI extension methods named `AddApplication`/`AddInfrastructure` registered in `Program.cs` via `builder.Services.AddX()`

## Past Mistakes

- Tests directly instantiate `InMemoryUserRepository` instead of resolving through DI; root cause: no service-provider test fixture exists yet

## Preferences

- Repository and service methods consistently accept `CancellationToken` as the final parameter with `= default`

## Project Gotchas

- `InMemoryUserRepository` enforces unique email constraints at the in-memory level to mirror EF Core/SQL Server behavior

## Proven Patterns

- Test doubles (`InMemoryUserRepository`) live in `Infrastructure` so both unit tests and future integration tests can share the same fake

## Anti-Patterns

- (none new this run)

---

_Last updated: 2026-05-28 · run mpq51rw3 · Register IUserRepository in DependencyInjection and create a_
