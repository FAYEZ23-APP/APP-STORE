# ─── Stage 1: Build & Publish ─────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution file and all .csproj files preserving directory structure for layer caching
COPY Marketplace.slnx ./
COPY Marketplace.Domain/Marketplace.Domain.csproj Marketplace.Domain/
COPY Marketplace.Application/Marketplace.Application.csproj Marketplace.Application/
COPY Marketplace.Infrastructure/Marketplace.Infrastructure.csproj Marketplace.Infrastructure/
COPY Marketplace.API/Marketplace.API.csproj Marketplace.API/

# Restore dependencies
RUN dotnet restore Marketplace.API/Marketplace.API.csproj

# Copy remaining source code
COPY . .

# Build and publish optimized release binaries
RUN dotnet publish Marketplace.API/Marketplace.API.csproj -c Release -o /app/publish /p:UseAppHost=false

# ─── Stage 2: Production Runtime ──────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Ensure /app/wwwroot/uploads directory exists with read/write permissions for volume mounts
RUN mkdir -p /app/wwwroot/uploads && chmod -R 777 /app/wwwroot/uploads

# Copy published application from build stage
COPY --from=build /app/publish .

# Production environment defaults (Railway dynamically overrides PORT)
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=5209

EXPOSE 5209

# Entrypoint
ENTRYPOINT ["dotnet", "Marketplace.API.dll"]
