# DJ-DiP Backend Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build
# .NET 10 GA, PINNED to a servicing patch (release-gate P1 2026-06-13): floating :10.0
# made the prod runtime patch level unprovable — 10.0.9 carries the Apr/Jun 2026 security
# fixes (CVE-2026-40372 DataProtection forgery, CVE-2026-45591 unauth DoS, et al.).
# Bump this tag deliberately on each .NET servicing release.
FROM mcr.microsoft.com/dotnet/sdk:10.0.9 AS build
WORKDIR /src

# Copy csproj files and restore dependencies
COPY ["DJDiP.csproj", "./"]
COPY ["Domain/Domain.csproj", "Domain/"]
COPY ["Application/Application.csproj", "Application/"]
COPY ["Infrastructure/Infrastructure.csproj", "Infrastructure/"]

RUN dotnet restore "DJDiP.csproj"

# Copy everything else and build
COPY . .
WORKDIR "/src"
RUN dotnet build "DJDiP.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "DJDiP.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
# Runtime pinned to the same servicing patch as the build stage (see note above).
FROM mcr.microsoft.com/dotnet/aspnet:10.0.9 AS final
WORKDIR /app

# Create non-root user
RUN groupadd -r djdip && useradd -r -g djdip djdip

# Create upload directory
RUN mkdir -p /app/wwwroot/uploads && \
    chown -R djdip:djdip /app/wwwroot

# Copy published app
COPY --from=publish /app/publish .

# Change ownership
RUN chown -R djdip:djdip /app

# Switch to non-root user
USER djdip

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Set environment variables
ENV ASPNETCORE_URLS=http://+:5000 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true

# Entry point
ENTRYPOINT ["dotnet", "DJDiP.dll"]
