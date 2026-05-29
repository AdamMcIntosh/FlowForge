namespace FlowForge.Api.Cors;

public static class CorsPolicies
{
    public const string FlowForge = "FlowForge";
}

public static class CorsExtensions
{
    public static IServiceCollection AddFlowForgeCors(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        services.AddCors(options =>
        {
            options.AddPolicy(CorsPolicies.FlowForge, policy =>
            {
                if (environment.IsProduction())
                {
                    var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
                    if (origins.Length == 0)
                    {
                        throw new InvalidOperationException(
                            "Cors:AllowedOrigins must contain at least one origin in Production.");
                    }

                    policy.WithOrigins(origins)
                        .AllowAnyHeader()
                        .AllowAnyMethod();
                }
                else
                {
                    policy.SetIsOriginAllowed(_ => true)
                        .AllowAnyHeader()
                        .AllowAnyMethod();
                }
            });
        });

        return services;
    }

    public static WebApplication UseFlowForgeCors(this WebApplication app)
    {
        app.UseCors(CorsPolicies.FlowForge);
        return app;
    }
}
