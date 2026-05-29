using FlowForge.Infrastructure.Persistence;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace FlowForge.Api.HealthChecks;

public static class HealthCheckNames
{
    public const string Self = "self";
    public const string Database = "database";
}

public static class HealthCheckExtensions
{
    public static IServiceCollection AddFlowForgeHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck(
                HealthCheckNames.Self,
                () => HealthCheckResult.Healthy("Application is running."),
                tags: ["live"])
            .AddDbContextCheck<FlowForgeDbContext>(
                name: HealthCheckNames.Database,
                failureStatus: HealthStatus.Unhealthy,
                tags: ["ready"]);

        return services;
    }
}
