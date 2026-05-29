using FlowForge.Api.Endpoints;
using FlowForge.Api.Validation;
using FlowForge.Domain.Projects;
using FluentValidation.TestHelper;

namespace FlowForge.Tests;

public class ProjectRequestValidatorTests
{
    private readonly CreateProjectRequestValidator _createValidator = new();
    private readonly UpdateProjectRequestValidator _updateValidator = new();

    [Fact]
    public void CreateProjectRequest_WithEmptyName_HasValidationError()
    {
        var result = _createValidator.TestValidate(new CreateProjectRequest(""));
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Project name is required.");
    }

    [Fact]
    public void CreateProjectRequest_WithWhitespaceName_HasValidationError()
    {
        var result = _createValidator.TestValidate(new CreateProjectRequest("   "));
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Project name is required.");
    }

    [Fact]
    public void CreateProjectRequest_WithNameTooLong_HasValidationError()
    {
        var name = new string('a', Project.MaxNameLength + 1);
        var result = _createValidator.TestValidate(new CreateProjectRequest(name));
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Project name is too long.");
    }

    [Fact]
    public void CreateProjectRequest_WithValidName_IsValid()
    {
        var result = _createValidator.TestValidate(new CreateProjectRequest("My Project"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateProjectRequest_WithEmptyName_HasValidationError()
    {
        var result = _updateValidator.TestValidate(new UpdateProjectRequest(""));
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Project name is required.");
    }
}
