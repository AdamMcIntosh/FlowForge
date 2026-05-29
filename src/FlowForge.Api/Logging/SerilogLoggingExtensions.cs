using Serilog;

namespace FlowForge.Api.Logging;

public static class SerilogLoggingExtensions
{
    public const string EnabledConfigurationKey = "Serilog:Enabled";

    public static WebApplicationBuilder AddFlowForgeSerilogIfEnabled(this WebApplicationBuilder builder)
    {
        if (builder.Configuration.GetValue(EnabledConfigurationKey, true))
        {
            builder.Host.AddFlowForgeSerilog();
        }

        return builder;
    }

    public static IHostBuilder AddFlowForgeSerilog(this IHostBuilder host) =>
        host.UseSerilog((context, services, configuration) => configuration
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Application", "FlowForge.Api"));

    public static async Task CloseAndFlushSerilogAsync()
    {
        await Log.CloseAndFlushAsync();
    }
}
