using FlowForge.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowForge.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");

        builder.HasKey(user => user.Id);

        builder.Property(user => user.Id)
            .ValueGeneratedNever();

        builder.Property(user => user.UserId)
            .HasConversion(
                userId => userId.Value,
                value => UserId.From(value))
            .HasColumnName("UserId")
            .IsRequired();

        builder.Property(user => user.Email)
            .HasConversion(
                email => email.Value,
                value => Email.Create(value))
            .HasColumnName("Email")
            .HasMaxLength(320)
            .IsRequired();

        builder.HasIndex(user => user.Email)
            .IsUnique();

        builder.Property(user => user.PasswordHash)
            .HasConversion(
                passwordHash => passwordHash == null ? null : passwordHash.Value,
                value => value == null ? null : PasswordHash.Create(value))
            .HasColumnName("PasswordHash")
            .HasMaxLength(PasswordHash.MaxLength);

        builder.Property(user => user.CreatedAt)
            .IsRequired();

        builder.Property(user => user.UpdatedAt)
            .IsRequired();
    }
}
