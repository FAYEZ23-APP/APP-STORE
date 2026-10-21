using Microsoft.EntityFrameworkCore;
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
builder.Services.AddControllers(options => options.Filters.Add<ValidationFilter>())
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

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
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var db = scope.ServiceProvider.GetRequiredService<Marketplace.Infrastructure.Data.AppDbContext>();
    var useInMemory = string.Equals(app.Configuration["UseInMemoryDatabase"], "true", StringComparison.OrdinalIgnoreCase);

    try
    {
        if (useInMemory)
        {
            await db.Database.EnsureCreatedAsync();
            logger.LogInformation("Database initialized using InMemory provider.");
        }
        else
        {
            logger.LogInformation("Applying EF Core PostgreSQL migrations on startup...");
            await db.Database.MigrateAsync();
            logger.LogInformation("Database migrations applied successfully.");
        }

        // Seed initial categories if none exist
        if (!await db.Categories.AnyAsync())
        {
            db.Categories.AddRange(
                new Marketplace.Domain.Entities.Category { Id = 1, Key = "electronics", IconName = "devices" },
                new Marketplace.Domain.Entities.Category { Id = 2, Key = "clothing", IconName = "shirt" },
                new Marketplace.Domain.Entities.Category { Id = 3, Key = "shoes", IconName = "shoe-sneaker" },
                new Marketplace.Domain.Entities.Category { Id = 4, Key = "home", IconName = "home" },
                new Marketplace.Domain.Entities.Category { Id = 5, Key = "beauty", IconName = "sparkles" },
                new Marketplace.Domain.Entities.Category { Id = 6, Key = "kids", IconName = "baby" },
                new Marketplace.Domain.Entities.Category { Id = 7, Key = "sports", IconName = "basketball" },
                new Marketplace.Domain.Entities.Category { Id = 8, Key = "accessories", IconName = "watch" },
                new Marketplace.Domain.Entities.Category { Id = 9, Key = "other", IconName = "dots-horizontal" }
            );
            await db.SaveChangesAsync();
            logger.LogInformation("Core categories seeded successfully.");
        }

        // Seed admin user
        var adminEmail = "admin@marketplace.eg";
        if (!await db.Users.AnyAsync(u => u.Email == adminEmail))
        {
            string? adminPassword = Environment.GetEnvironmentVariable("ADMIN_INITIAL_PASSWORD")
                                    ?? Environment.GetEnvironmentVariable("ADMIN_PASSWORD")
                                    ?? app.Configuration["AdminSeed:Password"]
                                    ?? "Admin123!";

            var hasher = scope.ServiceProvider.GetRequiredService<Marketplace.Application.Interfaces.IPasswordHasher>();
            db.Users.Add(new Marketplace.Domain.Entities.User
            {
                Name = "مدير المنصة",
                Email = adminEmail,
                PasswordHash = hasher.Hash(adminPassword),
                Role = Marketplace.Domain.Enums.UserRole.Admin,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            logger.LogInformation("Initial platform admin seeded: {AdminEmail}", adminEmail);
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred during database migration or startup seeding.");
        if (!app.Environment.IsDevelopment())
        {
            throw;
        }
    }
}

app.UseMiddleware<GlobalExceptionMiddleware>();

if (app.Environment.IsDevelopment() || string.Equals(Environment.GetEnvironmentVariable("ENABLE_SWAGGER"), "true", StringComparison.OrdinalIgnoreCase))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Headers", "*");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    }
});

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
