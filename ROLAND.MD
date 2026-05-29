# Roland Project Instructions - FlowForge (.NET 10)

## Project Overview
FlowForge is a Task and Project management system being rewritten in .NET 10 using Clean Architecture.

## Core Rules for Roland

**Task Scoping**
- Prefer small, focused tasks (1 logical concept per task)
- Break large features into multiple small executor tasks
- Test-author and test-executor tasks should be narrowly scoped (max 5–8 tests per task)
- Always prefer incremental progress over large multi-task waves

**Architecture Enforcement**
- Strictly follow Clean Architecture layering
- Domain must remain free of infrastructure/framework references
- Repository interfaces belong in Domain; implementations in Infrastructure
- Use primary constructor injection
- All async methods must accept `CancellationToken = default`

**Testing Standards**
- All new features must include unit + integration tests
- Prefer in-memory SQLite for integration tests when possible
- Use `WebApplicationFactory` for HTTP-level tests
- Follow existing fixture patterns (`UserServiceEfCoreFixture`, etc.)

**Code Style**
- Use Minimal APIs (not controllers) unless complexity requires otherwise
- Records for DTOs and responses
- Explicit error handling with domain-specific exceptions
- Comprehensive XML documentation on public APIs

**Security & Production**
- Never hard-code secrets or connection strings
- Always include unique `jti` in JWT tokens
- Prefer configuration-based values (`IConfiguration`)
- Document any production prerequisites clearly

**Preferred Workflow**
- Small, sequential tasks when possible
- Clear commit messages following conventional format
- Update `ARCHITECTURE.md` and `DECISIONS.md` on significant changes
- Keep `README.md` up-to-date with usage examples
