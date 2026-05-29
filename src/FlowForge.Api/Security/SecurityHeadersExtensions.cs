namespace FlowForge.Api.Security;

public static class SecurityHeadersExtensions
{
    public static IServiceCollection AddFlowForgeSecurityHeaders(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        if (environment.IsProduction())
        {
            var maxAgeDays = configuration.GetValue("Hsts:MaxAgeDays", 365);
            var includeSubDomains = configuration.GetValue("Hsts:IncludeSubDomains", true);
            var preload = configuration.GetValue("Hsts:Preload", false);

            services.AddHsts(options =>
            {
                options.MaxAge = TimeSpan.FromDays(maxAgeDays);
                options.IncludeSubDomains = includeSubDomains;
                options.Preload = preload;
            });
        }

        return services;
    }

    public static WebApplication UseFlowForgeSecurityHeaders(this WebApplication app)
    {
        if (app.Environment.IsProduction())
        {
            app.UseHsts();
        }

        app.UseMiddleware<SecurityHeadersMiddleware>();
        return app;
    }
}

internal sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    private const string PermissionsPolicy =
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;

            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["Permissions-Policy"] = PermissionsPolicy;

            return Task.CompletedTask;
        });

        await next(context);
    }
}
