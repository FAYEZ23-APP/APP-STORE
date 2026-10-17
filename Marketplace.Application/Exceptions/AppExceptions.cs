namespace Marketplace.Application.Exceptions;

/// <summary>Base type for expected, client-facing errors. Mapped to HTTP status codes by the API middleware.</summary>
public abstract class AppException : Exception
{
    protected AppException(string message) : base(message) { }
}

/// <summary>404 — requested resource does not exist.</summary>
public class NotFoundException : AppException
{
    public NotFoundException(string message) : base(message) { }
}

/// <summary>409 — request conflicts with current state (e.g. email already registered).</summary>
public class ConflictException : AppException
{
    public ConflictException(string message) : base(message) { }
}

/// <summary>401 — missing or invalid credentials.</summary>
public class UnauthorizedException : AppException
{
    public UnauthorizedException(string message) : base(message) { }
}

/// <summary>403 — authenticated, but not allowed to touch this resource (e.g. not the owner).</summary>
public class ForbiddenException : AppException
{
    public ForbiddenException(string message) : base(message) { }
}

/// <summary>400 — business rule violated (e.g. insufficient stock).</summary>
public class BadRequestException : AppException
{
    public BadRequestException(string message) : base(message) { }
}
