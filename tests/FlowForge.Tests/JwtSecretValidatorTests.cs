using FlowForge.Api.Authentication;

namespace FlowForge.Tests;

public sealed class JwtSecretValidatorTests
{
    private const string ValidSecret = "FlowForge-Dev-Secret-Key-At-Least-32-Chars!";

    [Fact]
    public void Validate_WithValidDevelopmentSecret_ReturnsSecret()
    {
        var result = JwtSecretValidator.Validate(ValidSecret, isProduction: false);

        Assert.Equal(ValidSecret, result);
    }

    [Fact]
    public void Validate_WhenMissing_Throws()
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => JwtSecretValidator.Validate(null, isProduction: false));

        Assert.Equal("Jwt:Secret is required.", exception.Message);
    }

    [Fact]
    public void Validate_WhenTooShort_Throws()
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => JwtSecretValidator.Validate("short-secret", isProduction: false));

        Assert.Contains("at least 32 characters", exception.Message);
    }

    [Fact]
    public void Validate_WhenLowEntropy_Throws()
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => JwtSecretValidator.Validate(
                new string('a', 32),
                isProduction: false));

        Assert.Contains("distinct characters", exception.Message);
    }

    [Fact]
    public void Validate_InProduction_WithDevelopmentPlaceholder_Throws()
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => JwtSecretValidator.Validate(ValidSecret, isProduction: true));

        Assert.Contains("development placeholder", exception.Message);
    }

    [Fact]
    public void Validate_InProduction_WithStrongSecret_ReturnsSecret()
    {
        const string productionSecret = "k7P9mX2vQ4nR8wL1tY6hJ3cF5bN0sD9uA7gE2iK4oM6pZ8x";

        var result = JwtSecretValidator.Validate(productionSecret, isProduction: true);

        Assert.Equal(productionSecret, result);
    }
}
