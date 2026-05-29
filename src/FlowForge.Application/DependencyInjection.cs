using FlowForge.Application.Authentication;
using FlowForge.Application.Common.Interfaces;
using FlowForge.Application.Projects;
using FlowForge.Application.Users;
using Microsoft.Extensions.DependencyInjection;

namespace FlowForge.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IProjectService, ProjectService>();

        return services;
    }
}
