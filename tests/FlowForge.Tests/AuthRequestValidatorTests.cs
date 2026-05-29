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
    public void AuthRequest_WithPasswordTooShort_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("user@example.com", "Short1!"));
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password must be at least 12 characters long.");
    }

    [Fact]
    public void AuthRequest_WithPasswordTooLong_HasValidationError()
    {
        var password = $"Aa1!{new string('x', 125)}";

        var result = _validator.TestValidate(new AuthRequest("user@example.com", password));
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password must be at most 128 characters long.");
    }

    [Fact]
    public void AuthRequest_WithPasswordMissingUppercase_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("user@example.com", "securepass123!"));
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password must contain at least one uppercase letter.");
    }

    [Fact]
    public void AuthRequest_WithPasswordMissingLowercase_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("user@example.com", "SECUREPASS123!"));
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password must contain at least one lowercase letter.");
    }

    [Fact]
    public void AuthRequest_WithPasswordMissingDigit_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("user@example.com", "SecurePassword!"));
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password must contain at least one digit.");
    }

    [Fact]
    public void AuthRequest_WithPasswordMissingSpecialCharacter_HasValidationError()
    {
        var result = _validator.TestValidate(new AuthRequest("user@example.com", "SecurePass1234"));
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password must contain at least one special character.");
    }

    [Fact]
    public void AuthRequest_WithValidInput_IsValid()
    {
        var result = _validator.TestValidate(new AuthRequest("user@example.com", "SecurePass123!"));
        result.ShouldNotHaveAnyValidationErrors();
    }
}
