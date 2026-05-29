using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using FlowForge.Api.Endpoints;
using FlowForge.Api.Logging;
using FlowForge.Application.Common.Interfaces;
using FlowForge.Infrastructure.Authentication;
using FlowForge.Infrastructure.Persistence;
using FlowForge.Infrastructure.Persistence.Repositories;
using FlowForge.Domain.Users;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FlowForge.Tests;

public class TraceIdLogScopeTests : IClassFixture<TraceIdLogScopeWebApplicationFactory>
{
    private readonly TraceIdLogScopeWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public TraceIdLogScopeTests(TraceIdLogScopeWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_WithCorrelationHeader_PropagatesTraceIdIntoDownstreamLoggerScopes()
    {
        var expectedTraceId = Guid.NewGuid().ToString("N");
        var email = $"trace-{Guid.NewGuid():N}@example.com";

        using var request = new HttpRequestMessage(HttpMethod.Post, "/register")
        {
            Content = JsonContent.Create(new AuthRequest(email, "ValidPass123!")),
        };
        request.Headers.Add(TraceIdConstants.CorrelationIdHeader, expectedTraceId);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Contains(
            _factory.CapturedEntries,
            entry => entry.ScopeTraceId == expectedTraceId);
    }
}

public sealed class TraceIdLogScopeWebApplicationFactory : WebApplicationFactory<Program>, IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ConcurrentBag<CapturedLogEntry> _capturedEntries = [];

    public TraceIdLogScopeWebApplicationFactory()
    {
        _connection.Open();
    }

    public ConcurrentBag<CapturedLogEntry> CapturedEntries => _capturedEntries;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Database:Provider", "Sqlite");
        builder.UseSetting("ConnectionStrings:DefaultConnection", "Data Source=:memory:");
        builder.UseSetting("Jwt:Issuer", "FlowForge");
        builder.UseSetting("Jwt:Audience", "FlowForge");
        builder.UseSetting("Jwt:Secret", "FlowForge-Dev-Secret-Key-At-Least-32-Chars!");
        builder.UseSetting("Jwt:ExpiryMinutes", "60");
        builder.UseSetting("RateLimiting:PermitLimit", "10000");
        builder.UseSetting("RateLimiting:WindowSeconds", "60");
        builder.UseSetting(SerilogLoggingExtensions.EnabledConfigurationKey, "false");

        builder.ConfigureLogging(logging =>
        {
            logging.AddProvider(new CapturingLoggerProvider(_capturedEntries));
            logging.SetMinimumLevel(LogLevel.Debug);
        });

        builder.ConfigureTestServices(services =>
        {
            RemoveEfCoreRegistrations(services);

            services.AddDbContext<FlowForgeDbContext>(options => options.UseSqlite(_connection));
            services.AddScoped<IUserRepository, UserRepository>();
            services.AddScoped<IJwtTokenService, JwtTokenService>();
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);

        using var scope = host.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<FlowForgeDbContext>();
        dbContext.Database.EnsureCreated();

        return host;
    }

    public new void Dispose()
    {
        base.Dispose();
        _connection.Dispose();
    }

    private static void RemoveEfCoreRegistrations(IServiceCollection services)
    {
        var descriptors = services
            .Where(d =>
                d.ServiceType == typeof(FlowForgeDbContext) ||
                d.ServiceType == typeof(DbContextOptions<FlowForgeDbContext>) ||
                d.ServiceType == typeof(IUserRepository) ||
                d.ServiceType == typeof(IJwtTokenService) ||
                (d.ServiceType.FullName?.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ?? false) ||
                (d.ImplementationType?.FullName?.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ?? false))
            .ToList();

        foreach (var descriptor in descriptors)
        {
            services.Remove(descriptor);
        }
    }
}

public sealed record CapturedLogEntry(string? ScopeTraceId);

internal sealed class CapturingLoggerProvider(ConcurrentBag<CapturedLogEntry> entries)
    : ILoggerProvider, ISupportExternalScope
{
    private IExternalScopeProvider? _scopeProvider;

    public ILogger CreateLogger(string categoryName) =>
        new CapturingLogger(entries, _scopeProvider);

    public void SetScopeProvider(IExternalScopeProvider scopeProvider) =>
        _scopeProvider = scopeProvider;

    public void Dispose()
    {
    }
}

internal sealed class CapturingLogger(
    ConcurrentBag<CapturedLogEntry> entries,
    IExternalScopeProvider? scopeProvider) : ILogger
{
    public IDisposable? BeginScope<TState>(TState state)
        where TState : notnull =>
        scopeProvider?.Push(state) ?? NullScope.Instance;

    public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Debug;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel) || scopeProvider is null)
        {
            return;
        }

        string? traceId = null;
        scopeProvider.ForEachScope(
            (scope, _) =>
            {
                if (scope is not IEnumerable<KeyValuePair<string, object>> scopeState)
                {
                    return;
                }

                foreach (var pair in scopeState)
                {
                    if (pair.Key == TraceIdConstants.ScopePropertyName)
                    {
                        traceId = pair.Value?.ToString();
                    }
                }
            },
            state);

        if (traceId is not null)
        {
            entries.Add(new CapturedLogEntry(traceId));
        }
    }

    private sealed class NullScope : IDisposable
    {
        public static readonly NullScope Instance = new();

        public void Dispose()
        {
        }
    }
}
