using Marketplace.Application.DTOs.Auth;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUnitOfWork _uow;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtService _jwt;
    private readonly IGoogleTokenValidator _googleValidator;

    public AuthService(
        IUnitOfWork uow,
        IPasswordHasher hasher,
        IJwtService jwt,
        IGoogleTokenValidator googleValidator)
    {
        _uow = uow;
        _hasher = hasher;
        _jwt = jwt;
        _googleValidator = googleValidator;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var email = NormalizeEmail(request.Email);

        var existing = await _uow.Users.FindAsync(u => u.Email == email);
        if (existing.Any())
            throw new ConflictException("A user with this email already exists.");

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = _hasher.Hash(request.Password),
            Role = Enum.Parse<UserRole>(request.Role, ignoreCase: true)
        };

        await _uow.Users.AddAsync(user);
        await _uow.SaveChangesAsync();

        var consent = new UserConsent
        {
            UserId = user.Id,
            PolicyVersion = string.IsNullOrWhiteSpace(request.PolicyVersion) ? "1.0" : request.PolicyVersion.Trim(),
            AcceptedAt = DateTime.UtcNow,
            MarketingConsent = request.MarketingConsent
        };
        await _uow.UserConsents.AddAsync(consent);
        await _uow.SaveChangesAsync();

        return BuildResponse(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var email = NormalizeEmail(request.Email);

        var user = (await _uow.Users.FindAsync(u => u.Email == email)).FirstOrDefault();

        // Same message for "no such user" and "wrong password" — don't leak which emails exist.
        if (user is null || !_hasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedException("Invalid email or password.");

        if (!user.IsActive)
            throw new ForbiddenException("This account has been deactivated by an administrator.");

        return BuildResponse(user);
    }

    public async Task<AuthResponse> GoogleAuthAsync(GoogleAuthRequest request, CancellationToken cancellationToken = default)
    {
        var googleUser = await _googleValidator.ValidateTokenAsync(request.IdToken, cancellationToken);
        var email = NormalizeEmail(googleUser.Email);

        var existing = await _uow.Users.FindAsync(u => u.Email == email);
        var user = existing.FirstOrDefault();

        if (user is not null)
        {
            if (!user.IsActive)
                throw new ForbiddenException("This account has been deactivated by an administrator.");

            return BuildResponse(user);
        }

        // New registration through Google OAuth
        if (!request.AcceptedTermsAndPrivacy)
        {
            throw new BadRequestException("الموافقة الصريحة على الشروط وسياسة الخصوصية مطلوبة لإنشاء حساب (وفقاً للقانون المصري رقم 151 لسنة 2020 لحماية البيانات الشخصية).");
        }

        var roleStr = string.IsNullOrWhiteSpace(request.Role) ? "Buyer" : request.Role;
        if (!Enum.TryParse<UserRole>(roleStr, ignoreCase: true, out var role))
        {
            role = UserRole.Buyer;
        }

        var userName = string.IsNullOrWhiteSpace(googleUser.Name)
            ? email.Split('@')[0]
            : googleUser.Name.Trim();

        user = new User
        {
            Name = userName,
            Email = email,
            // A secure, unguessable random hash satisfies PostgreSQL NOT NULL constraint while
            // preventing unauthorized password-based logins until the user explicitly sets one.
            PasswordHash = _hasher.Hash(Guid.NewGuid().ToString("N")),
            Role = role
        };

        await _uow.Users.AddAsync(user);
        await _uow.SaveChangesAsync();

        var consent = new UserConsent
        {
            UserId = user.Id,
            PolicyVersion = string.IsNullOrWhiteSpace(request.PolicyVersion) ? "1.0" : request.PolicyVersion.Trim(),
            AcceptedAt = DateTime.UtcNow,
            MarketingConsent = request.MarketingConsent
        };
        await _uow.UserConsents.AddAsync(consent);
        await _uow.SaveChangesAsync();

        return BuildResponse(user);
    }

    private AuthResponse BuildResponse(User user)
    {
        var token = _jwt.GenerateToken(user);
        return new AuthResponse
        {
            Token = token.Token,
            ExpiresAt = token.ExpiresAt,
            UserId = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.ToString()
        };
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
