# DJ-DiP Docker Deployment Guide

This guide covers deploying DJ-DiP using Docker and Docker Compose.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Production Deployment](#production-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Management](#database-management)
6. [Monitoring and Logs](#monitoring-and-logs)
7. [Backup and Restore](#backup-and-restore)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- At least 2GB RAM available
- 10GB free disk space

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone <repository-url>
cd DJ-DiP

# Copy environment files
cp .env.example .env
cp Frontend/.env.example Frontend/.env

# Generate a secure JWT secret
openssl rand -base64 64

# Edit .env and add your configuration
nano .env
```

### 2. Build and Run

```bash
# Build and start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:5000
- **GraphQL Playground**: http://localhost:5000/graphql
- **Health Check**: http://localhost:5000/health

## Production Deployment

### 1. Environment Configuration

Create a `.env` file in the project root with production values:

```bash
# Database Configuration
POSTGRES_DB=djdip_prod
POSTGRES_USER=djdip_prod_user
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE
POSTGRES_PORT=5432

# Backend Configuration
ASPNETCORE_ENVIRONMENT=Production
BACKEND_PORT=5000
BACKEND_URL=https://api.yourdomain.com

# JWT Configuration (CRITICAL: Generate new secret!)
JWT_SECRET_KEY=YOUR_GENERATED_SECRET_FROM_OPENSSL
JWT_ISSUER=DJDiP
JWT_AUDIENCE=DJDiP
JWT_ACCESS_TOKEN_MINUTES=60

# CORS Configuration
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Frontend Configuration
FRONTEND_PORT=80
FRONTEND_URL=https://yourdomain.com
VITE_API_URL=https://api.yourdomain.com/graphql
VITE_WS_URL=wss://api.yourdomain.com/graphql
VITE_UPLOAD_API_URL=https://api.yourdomain.com/api/upload
```

### 2. Build Production Images

```bash
# Build all images
docker-compose build --no-cache

# Or build individually
docker-compose build backend
docker-compose build frontend
```

### 3. Start Production Services

```bash
# Start all services in detached mode
docker-compose up -d

# Apply database migrations (first time only)
docker-compose exec backend dotnet ef database update

# Or let the app auto-migrate on startup (already configured)
```

### 4. Verify Deployment

```bash
# Check all services are healthy
docker-compose ps

# Test health endpoint
curl http://localhost:5000/health

# Check logs for errors
docker-compose logs backend
docker-compose logs frontend
```

## Environment Configuration

### Backend Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ASPNETCORE_ENVIRONMENT` | Environment (Development/Production) | Yes | Production |
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string | Yes | - |
| `Jwt__Key` | JWT signing key (min 32 chars) | Yes | - |
| `Jwt__Issuer` | JWT issuer | Yes | DJDiP |
| `Jwt__Audience` | JWT audience | Yes | DJDiP |
| `Jwt__AccessTokenMinutes` | Token expiration (minutes) | No | 60 |
| `CORS__AllowedOrigins` | Allowed CORS origins | Yes | - |
| `AppSettings__BaseUrl` | Backend base URL | Yes | - |
| `AppSettings__FrontendUrl` | Frontend base URL | Yes | - |

### Frontend Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend GraphQL URL | Yes | - |
| `VITE_WS_URL` | WebSocket URL for GraphQL subscriptions | Yes | - |
| `VITE_UPLOAD_API_URL` | File upload API URL | Yes | - |

### Database Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `POSTGRES_DB` | Database name | Yes | djdip_db |
| `POSTGRES_USER` | Database user | Yes | djdip_user |
| `POSTGRES_PASSWORD` | Database password | Yes | - |
| `POSTGRES_PORT` | Database port | No | 5432 |

## Database Management

### Migrations

```bash
# Apply migrations
docker-compose exec backend dotnet ef database update

# Create new migration
docker-compose exec backend dotnet ef migrations add MigrationName

# Rollback migration
docker-compose exec backend dotnet ef database update PreviousMigrationName
```

### Database Access

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U djdip_user -d djdip_db

# Run SQL query
docker-compose exec postgres psql -U djdip_user -d djdip_db -c "SELECT COUNT(*) FROM \"Events\";"
```

## Monitoring and Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Resource Usage

```bash
# Check resource usage
docker stats

# Specific containers
docker stats djdip-backend djdip-frontend djdip-postgres
```

### Health Checks

```bash
# Backend health
curl http://localhost:5000/health

# Check container health
docker inspect --format='{{.State.Health.Status}}' djdip-backend
docker inspect --format='{{.State.Health.Status}}' djdip-frontend
docker inspect --format='{{.State.Health.Status}}' djdip-postgres
```

## Backup and Restore

### Automated Backups

```bash
# Run backup script
./scripts/backup-docker.sh

# Schedule with cron (daily at 2 AM)
0 2 * * * /path/to/DJ-DiP/scripts/backup-docker.sh
```

### Manual Backup

```bash
# Create backup
docker exec djdip-postgres pg_dump -U djdip_user -d djdip_db > backup.sql

# Compress backup
gzip backup.sql
```

### Restore from Backup

```bash
# Restore uncompressed backup
docker exec -i djdip-postgres psql -U djdip_user -d djdip_db < backup.sql

# Restore compressed backup
gunzip -c backup.sql.gz | docker exec -i djdip-postgres psql -U djdip_user -d djdip_db
```

### Backup Uploads

```bash
# Backup uploaded files
docker run --rm -v djdip_uploads:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz /data
```

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Remove and recreate
docker-compose down
docker-compose up -d
```

#### Database Connection Errors

```bash
# Verify database is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec backend dotnet ef database update
```

#### Port Already in Use

```bash
# Change ports in .env file
BACKEND_PORT=5001
FRONTEND_PORT=8080

# Restart services
docker-compose down
docker-compose up -d
```

#### Out of Disk Space

```bash
# Clean up unused resources
docker system prune -a --volumes

# Remove old images
docker image prune -a
```

### Reset Everything

```bash
# WARNING: This deletes all data!
docker-compose down -v
docker-compose up -d
```

### Performance Tuning

#### Increase Database Memory

Edit `docker-compose.yml`:

```yaml
postgres:
  command: postgres -c shared_buffers=256MB -c max_connections=200
```

#### Enable HTTP/2

Use a reverse proxy like Nginx or Traefik in front of your services.

## Production Recommendations

### 1. Use a Reverse Proxy

Deploy Nginx or Traefik to:
- Handle SSL/TLS termination
- Load balancing
- Rate limiting
- Compression

### 2. Enable SSL/TLS

```bash
# Example with Let's Encrypt + Nginx
docker run -d \
  -p 80:80 -p 443:443 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  nginx:alpine
```

### 3. Set Up Monitoring

- Application Insights
- Prometheus + Grafana
- ELK Stack (Elasticsearch, Logstash, Kibana)

### 4. Configure Backups

```bash
# Add to crontab
0 2 * * * /path/to/scripts/backup-docker.sh
0 3 * * 0 /path/to/scripts/backup-uploads.sh
```

### 5. Resource Limits

Add to `docker-compose.yml`:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 512M
```

## Scaling

### Horizontal Scaling

```bash
# Scale backend instances
docker-compose up -d --scale backend=3

# Requires load balancer configuration
```

### Database Replication

Set up PostgreSQL primary-replica configuration for read scaling.

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate new JWT secret
- [ ] Configure firewall rules
- [ ] Enable SSL/TLS
- [ ] Set up automated backups
- [ ] Enable monitoring and alerts
- [ ] Review and restrict CORS origins
- [ ] Implement rate limiting
- [ ] Regular security updates
- [ ] Secure sensitive environment variables

## Support

For issues and questions:
- Check logs: `docker-compose logs`
- Review documentation in `Documentation/`
- Check GitHub issues

---

**Last Updated**: 2025-11-17
