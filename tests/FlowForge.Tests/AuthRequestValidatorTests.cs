using FlowForge.Api.Endpoints;
using FlowForge.Api.Validation;
using FluentValidation.TestHelper;

namespace FlowForge.Tests;

public class AuthRequestValidatorTests
{
    private readonly AuthRequestValidator _validator = new();

    [Fact]
    public void AuthRequest_WithEmptyEmail_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("", "SecurePass123!"));
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Email is required.");
    }

    [Fact]
    public void AuthRequest_WithWhitespaceEmail_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("   ", "SecurePass123!"));
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Email is required.");
    }

    [Fact]
    public void AuthRequest_WithInvalidEmailFormat_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("not-an-email", "SecurePass123!"));
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Email address format is invalid.");
    }

    [Fact]
    public void AuthRequest_WithEmailTooLong_HasValidationError()
    {
        var localPart = new string('a', 310);
        var email = $"{localPart}@example.com";

        var result = _validator.TestValidate(new AuthRequest(email, "SecurePass123!"));
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Email address is too long.");
    }

    [Fact]
    public void AuthRequest_WithEmptyPassword_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("user@example.com", ""));
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password is required.");
    }

    [Fact]
    public void AuthRequest_WithWhitespacePassword_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("user@example.com", "   "));
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password is required.");
    }

    [Fact]
    public void AuthRequest_WithValidInput_IsValid()
    {
        var result = _validator.TestValidate(new AuthRequest("user@example.com", "SecurePass123!"));
        result.ShouldNotHaveAnyValidationErrors();
    }
}
