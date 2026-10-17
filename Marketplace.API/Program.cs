using System.Text;
using System.Threading.RateLimiting;
using Marketplace.API.Filters;
using Marketplace.API.Middleware;
using Marketplace.Application;
using Marketplace.Infrastructure;
using Marketplace.Infrastructure.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// ─── Layers ─────────────────────────────────────────────────
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// ─── Controllers + FluentValidation filter ──────────────────
builder.Services.AddControllers(options => options.Filters.Add<ValidationFilter>());

// ─── Authentication (JWT Bearer) ────────────────────────────
var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
          ?? throw new InvalidOperationException("Jwt settings are missing.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // keep short claim names: sub, email, name, role
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            NameClaimType = JwtService.ClaimNames.Name,
            RoleClaimType = JwtService.ClaimNames.Role, // makes [Authorize(Roles = "Seller")] work
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

// ─── Swagger (with "Authorize" button for JWT) ─────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Marketplace API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Paste the JWT token returned by /api/auth/login"
    });

    c.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = new List<string>()
    });

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    c.IncludeXmlComments(xmlPath);

    c.DocInclusionPredicate((docName, apiDesc) =>
    {
        if (!builder.Environment.IsDevelopment() &&
            apiDesc.RelativePath?.StartsWith("api/dev", StringComparison.OrdinalIgnoreCase) == true)
        {
            return false;
        }
        return true;
    });
});

// ─── CORS ───────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    if (builder.Environment.IsDevelopment())
    {
        options.AddPolicy("AllowAll", policy =>
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
    }
    else
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
                             ?? Array.Empty<string>();

        options.AddPolicy("AllowAll", policy =>
        {
            if (allowedOrigins.Length > 0)
            {
                policy.WithOrigins(allowedOrigins)
                      .AllowAnyMethod()
                      .AllowAnyHeader()
                      .AllowCredentials();
            }
            else
            {
                policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
            }
        });
    }
});

// ─── Rate Limiting (IP Partitioned) ─────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth-policy", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var isDev = builder.Environment.IsDevelopment();
        return RateLimitPartition.GetFixedWindowLimiter(
            ip,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = isDev ? 1000 : 15,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<Marketplace.Infrastructure.Data.AppDbContext>();
    if (string.Equals(app.Configuration["UseInMemoryDatabase"], "true", StringComparison.OrdinalIgnoreCase))
    {
        db.Database.EnsureCreated();
    }

    var adminEmail = "admin@marketplace.eg";
    if (!db.Users.Any(u => u.Email == adminEmail))
    {
        var hasher = scope.ServiceProvider.GetRequiredService<Marketplace.Application.Interfaces.IPasswordHasher>();
        db.Users.Add(new Marketplace.Domain.Entities.User
        {
            Name = "مدير المنصة",
            Email = adminEmail,
            PasswordHash = hasher.Hash("Admin123!"),
            Role = Marketplace.Domain.Enums.UserRole.Admin,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();
    }
}

app.UseMiddleware<GlobalExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles();

app.UseCors("AllowAll");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
