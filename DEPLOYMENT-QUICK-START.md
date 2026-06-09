# DJ-DiP Deployment Quick Start

Get DJ-DiP running in production in under 30 minutes.

## Option 1: Docker Compose (Fastest)

### Step 1: Prerequisites

```bash
# Install Docker and Docker Compose
# macOS: Docker Desktop
# Linux: docker.io and docker-compose
# Windows: Docker Desktop
```

### Step 2: Configure

```bash
# Clone repository
git clone <your-repo-url>
cd DJ-DiP

# Copy environment files
cp .env.example .env

# Generate JWT secret
openssl rand -base64 64

# Edit .env file
nano .env
```

Required `.env` configuration:

```bash
# Database
POSTGRES_DB=djdip_prod
POSTGRES_USER=djdip_admin
POSTGRES_PASSWORD=CHANGE_ME_SECURE_PASSWORD

# JWT (paste the generated secret from openssl)
JWT_SECRET_KEY=YOUR_GENERATED_SECRET_HERE

# CORS (add your domain)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Step 3: Deploy

```bash
# Build and start
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 4: Verify

- Frontend: http://localhost
- Backend API: http://localhost:5000/graphql
- Health: http://localhost:5000/health

**Done!** Your app is running.

---

## Option 2: Azure (Cloud)

### Step 1: Prerequisites

```bash
# Install Azure CLI
brew install azure-cli  # macOS
# or download from https://aka.ms/installazurecliwindows

# Login
az login
```

### Step 2: Create Resources

```bash
# Set variables
RG="djdip-rg"
LOCATION="eastus"
APP_NAME="djdip-$(date +%s)"

# Create resource group
az group create --name $RG --location $LOCATION

# Create PostgreSQL
az postgres flexible-server create \
  --name ${APP_NAME}-db \
  --resource-group $RG \
  --location $LOCATION \
  --admin-user djdip_admin \
  --admin-password "SECURE_PASSWORD_HERE" \
  --sku-name Standard_B2s \
  --version 16

# Create database
az postgres flexible-server db create \
  --server-name ${APP_NAME}-db \
  --resource-group $RG \
  --database-name djdip_prod
```

### Step 3: Deploy Backend

```bash
# Build
dotnet publish -c Release -o ./publish

# Create App Service
az webapp up \
  --resource-group $RG \
  --name ${APP_NAME}-api \
  --runtime "DOTNETCORE:8.0" \
  --sku B1

# Configure app settings
az webapp config appsettings set \
  --name ${APP_NAME}-api \
  --resource-group $RG \
  --settings \
    ASPNETCORE_ENVIRONMENT=Production \
    "Jwt__Key=$(openssl rand -base64 64)"
```

### Step 4: Deploy Frontend

```bash
cd Frontend

# Build
VITE_API_URL=https://${APP_NAME}-api.azurewebsites.net/graphql \
npm run build

# Create Static Web App
az staticwebapp create \
  --name ${APP_NAME}-web \
  --resource-group $RG \
  --location $LOCATION

# Upload build (use Azure portal or CLI)
```

**Done!** Your app is on Azure.

---

## Option 3: DigitalOcean (Easiest Cloud)

### Step 1: Prerequisites

- DigitalOcean account
- GitHub repository

### Step 2: Connect Repository

1. Go to DigitalOcean App Platform
2. Click "Create App"
3. Connect your GitHub repository
4. Select `DJ-DiP` repo

### Step 3: Configure

App Platform will detect the Dockerfile. Configure:

**Backend Service**:
- Dockerfile: `Dockerfile`
- Port: 5000
- Environment variables:
  - `ASPNETCORE_ENVIRONMENT=Production`
  - `Jwt__Key=<generate secure key>`

**Frontend Service**:
- Dockerfile: `Frontend/Dockerfile`
- Port: 80
- Environment variables:
  - `VITE_API_URL=${backend.PUBLIC_URL}/graphql`

**Database**:
- Add PostgreSQL database (managed)

### Step 4: Deploy

Click "Deploy" and wait 5-10 minutes.

**Done!** DigitalOcean handles everything.

---

## Option 4: AWS (Enterprise)

### Step 1: Prerequisites

```bash
# Install AWS CLI
brew install awscli  # macOS

# Configure
aws configure

# Install EB CLI
pip install awsebcli
```

### Step 2: Initialize and Deploy

```bash
# Initialize Elastic Beanstalk
eb init -p docker djdip-backend

# Create environment with database
eb create djdip-prod \
  --database \
  --database.engine postgres \
  --envvars ASPNETCORE_ENVIRONMENT=Production

# Deploy
eb deploy

# Open app
eb open
```

**Done!** Running on AWS.

---

## Next Steps

### 1. Set Up Custom Domain

Point your domain to the deployment:

```
Type  Name  Value
A     @     YOUR_SERVER_IP
CNAME www   your-app.platform.com
```

### 2. Enable SSL/TLS

Most platforms offer automatic SSL:
- DigitalOcean: Automatic
- Azure: Enable in portal
- AWS: Use Certificate Manager
- Docker: Use Nginx/Traefik + Let's Encrypt

### 3. Configure Monitoring

- Set up uptime monitoring (UptimeRobot, Pingdom)
- Enable error tracking (Sentry)
- Configure alerts

### 4. Set Up Backups

```bash
# Docker
./scripts/backup-docker.sh

# Cloud: Enable automatic backups in platform settings
```

### 5. Test Everything

```bash
# Health check
curl https://your-api-url.com/health

# GraphQL
curl -X POST https://your-api-url.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'

# Frontend
open https://your-domain.com
```

---

## Troubleshooting

### App won't start

```bash
# Docker
docker-compose logs backend

# Azure
az webapp log tail --name your-app --resource-group your-rg

# AWS
eb logs

# DigitalOcean
Check logs in App Platform dashboard
```

### Database connection error

1. Check connection string
2. Verify database is running
3. Check firewall rules
4. Verify SSL settings

### 502 Bad Gateway

1. Check if backend is running
2. Verify health endpoint
3. Check environment variables
4. Review application logs

---

## Security Checklist

Before going live:

- [ ] Change all default passwords
- [ ] Generate new JWT secret (64+ characters)
- [ ] Enable SSL/TLS
- [ ] Configure CORS (only allow your domain)
- [ ] Set up firewall rules
- [ ] Enable automated backups
- [ ] Set up monitoring and alerts
- [ ] Review and test disaster recovery
- [ ] Run security audit
- [ ] Test all critical user flows

---

## Cost Estimates

### Docker on VPS
- **Small**: $5-20/month (DigitalOcean Droplet, Linode)
- **Medium**: $40-80/month (Better CPU/RAM)

### Cloud Platforms
- **DigitalOcean**: $12-50/month (App Platform + DB)
- **Azure**: $50-150/month (App Service + Database)
- **AWS**: $60-180/month (Elastic Beanstalk + RDS)
- **Google Cloud**: $50-150/month (Cloud Run + Cloud SQL)

All estimates for small to medium traffic (< 10K users).

---

## Need Help?

- Full guide: [PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md)
- Docker guide: [DOCKER-DEPLOYMENT.md](./DOCKER-DEPLOYMENT.md)
- Troubleshooting: [Documentation/TROUBLESHOOTING.md](./Documentation/TROUBLESHOOTING.md)

---

**Last Updated**: 2025-11-17
