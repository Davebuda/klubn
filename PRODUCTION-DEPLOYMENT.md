# DJ-DiP Production Deployment Guide

Complete guide for deploying DJ-DiP to production environments.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Options](#deployment-options)
3. [Cloud Platform Guides](#cloud-platform-guides)
4. [Post-Deployment Steps](#post-deployment-steps)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Pre-Deployment Checklist

### Security

- [ ] Generate secure JWT secret (minimum 64 characters)
- [ ] Change all default passwords
- [ ] Configure SSL/TLS certificates
- [ ] Set up firewall rules
- [ ] Review CORS origins
- [ ] Enable rate limiting
- [ ] Configure security headers
- [ ] Audit dependencies for vulnerabilities

### Database

- [ ] Plan database backup strategy
- [ ] Set up automated backups
- [ ] Test restore procedures
- [ ] Configure database connection pooling
- [ ] Plan for database scaling

### Configuration

- [ ] Create production environment variables
- [ ] Configure logging level (Warning/Error)
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure CDN for static assets
- [ ] Set up email service
- [ ] Configure payment gateway

### Testing

- [ ] Run all manual test scripts
- [ ] Perform load testing
- [ ] Test backup and restore
- [ ] Verify SSL/TLS configuration
- [ ] Test all critical user flows

## Deployment Options

### Option 1: Docker Compose (Recommended for Small-Medium Apps)

**Best for**: VPS, dedicated servers, small to medium traffic

See [DOCKER-DEPLOYMENT.md](./DOCKER-DEPLOYMENT.md) for detailed instructions.

**Pros**:
- Simple setup
- Portable
- Easy to scale vertically
- Cost-effective

**Cons**:
- Manual scaling required
- Single server deployment

### Option 2: Cloud Platform (Recommended for Production)

**Best for**: Production applications, high availability, automatic scaling

Platforms covered:
- Azure App Service
- AWS Elastic Beanstalk
- Google Cloud Run
- DigitalOcean App Platform

### Option 3: Kubernetes

**Best for**: Large-scale applications, microservices, enterprise

**Pros**:
- Automatic scaling
- High availability
- Self-healing
- Advanced deployment strategies

**Cons**:
- Complex setup
- Higher cost
- Steeper learning curve

## Cloud Platform Guides

### Azure App Service

#### Prerequisites

```bash
# Install Azure CLI
brew install azure-cli  # macOS
# or download from https://docs.microsoft.com/cli/azure/install-azure-cli

# Login
az login
```

#### Backend Deployment

```bash
# Create resource group
az group create --name djdip-rg --location eastus

# Create PostgreSQL database
az postgres flexible-server create \
  --resource-group djdip-rg \
  --name djdip-db-server \
  --location eastus \
  --admin-user djdip_admin \
  --admin-password YOUR_SECURE_PASSWORD \
  --sku-name Standard_B2s \
  --version 16

# Create database
az postgres flexible-server db create \
  --resource-group djdip-rg \
  --server-name djdip-db-server \
  --database-name djdip_prod

# Create App Service Plan
az appservice plan create \
  --name djdip-plan \
  --resource-group djdip-rg \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --resource-group djdip-rg \
  --plan djdip-plan \
  --name djdip-backend \
  --runtime "DOTNETCORE:8.0"

# Configure environment variables
az webapp config appsettings set \
  --resource-group djdip-rg \
  --name djdip-backend \
  --settings \
    ASPNETCORE_ENVIRONMENT=Production \
    "ConnectionStrings__DefaultConnection=Host=djdip-db-server.postgres.database.azure.com;Database=djdip_prod;Username=djdip_admin;Password=YOUR_PASSWORD;SslMode=Require" \
    "Jwt__Key=YOUR_JWT_SECRET" \
    "Jwt__Issuer=DJDiP" \
    "Jwt__Audience=DJDiP"

# Deploy
dotnet publish -c Release -o ./publish
cd publish
zip -r ../deploy.zip .
az webapp deployment source config-zip \
  --resource-group djdip-rg \
  --name djdip-backend \
  --src ../deploy.zip
```

#### Frontend Deployment

```bash
# Create Static Web App
az staticwebapp create \
  --name djdip-frontend \
  --resource-group djdip-rg \
  --location eastus

# Build frontend
cd Frontend
npm install
VITE_API_URL=https://djdip-backend.azurewebsites.net/graphql \
VITE_WS_URL=wss://djdip-backend.azurewebsites.net/graphql \
npm run build

# Deploy (use Azure Static Web Apps CLI or GitHub Actions)
```

### AWS Elastic Beanstalk

#### Prerequisites

```bash
# Install AWS CLI
brew install awscli  # macOS

# Configure AWS credentials
aws configure
```

#### Backend Deployment

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init -p "64bit Amazon Linux 2023 v3.0.0 running .NET 8" djdip-backend

# Create environment
eb create djdip-prod \
  --database \
  --database.engine postgres \
  --database.username djdip_admin \
  --envvars \
    ASPNETCORE_ENVIRONMENT=Production,\
    Jwt__Key=YOUR_JWT_SECRET

# Deploy
eb deploy

# Open app
eb open
```

#### Frontend Deployment (AWS Amplify)

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
cd Frontend
amplify init

# Add hosting
amplify add hosting

# Publish
amplify publish
```

### Google Cloud Run

#### Prerequisites

```bash
# Install gcloud CLI
brew install google-cloud-sdk  # macOS

# Login
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID
```

#### Backend Deployment

```bash
# Build and push Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/djdip-backend

# Deploy to Cloud Run
gcloud run deploy djdip-backend \
  --image gcr.io/YOUR_PROJECT_ID/djdip-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars ASPNETCORE_ENVIRONMENT=Production,Jwt__Key=YOUR_JWT_SECRET
```

#### Database Setup (Cloud SQL)

```bash
# Create PostgreSQL instance
gcloud sql instances create djdip-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create djdip_prod --instance=djdip-db

# Create user
gcloud sql users create djdip_admin \
  --instance=djdip-db \
  --password=YOUR_SECURE_PASSWORD
```

### DigitalOcean App Platform

#### Prerequisites

```bash
# Install doctl
brew install doctl  # macOS

# Authenticate
doctl auth init
```

#### Deployment via doctl

```bash
# Create app spec
cat > .do/app.yaml <<EOF
name: djdip
region: nyc
databases:
  - name: djdip-db
    engine: PG
    production: true
    version: "16"
services:
  - name: backend
    source:
      repo: YOUR_GITHUB_REPO
      branch: main
    dockerfile_path: Dockerfile
    environment_slug: docker
    envs:
      - key: ASPNETCORE_ENVIRONMENT
        value: Production
      - key: Jwt__Key
        value: YOUR_JWT_SECRET
        type: SECRET
    health_check:
      http_path: /health
  - name: frontend
    source:
      repo: YOUR_GITHUB_REPO
      branch: main
    dockerfile_path: Frontend/Dockerfile
    environment_slug: docker
    envs:
      - key: VITE_API_URL
        value: \${backend.PUBLIC_URL}/graphql
EOF

# Create app
doctl apps create --spec .do/app.yaml

# Get app ID
doctl apps list

# Monitor deployment
doctl apps logs APP_ID --follow
```

### Vercel (Frontend Only)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd Frontend
vercel --prod
```

## Post-Deployment Steps

### 1. Verify Deployment

```bash
# Test health endpoint
curl https://your-backend-url.com/health

# Test GraphQL endpoint
curl -X POST https://your-backend-url.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'

# Test frontend
curl https://your-frontend-url.com
```

### 2. Configure DNS

Point your domain to the deployment:

```
Type  Name              Value
A     @                 YOUR_IP_ADDRESS
A     www               YOUR_IP_ADDRESS
CNAME api               your-backend-url.azurewebsites.net
```

### 3. Set Up SSL/TLS

Most cloud platforms provide automatic SSL:
- Azure: Enable Custom Domain + SSL in portal
- AWS: Use AWS Certificate Manager
- Google Cloud: Automatic with Cloud Run
- DigitalOcean: Automatic with App Platform

For custom setup:

```bash
# Using Let's Encrypt with Certbot
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 4. Configure Monitoring

#### Application Insights (Azure)

```bash
# Add instrumentation key to app settings
az webapp config appsettings set \
  --name djdip-backend \
  --settings ApplicationInsights__InstrumentationKey=YOUR_KEY
```

#### CloudWatch (AWS)

```bash
# EB automatically sets up CloudWatch
# View logs
eb logs
```

### 5. Set Up Automated Backups

```bash
# Azure PostgreSQL
az postgres flexible-server backup create \
  --resource-group djdip-rg \
  --name djdip-db-server

# AWS RDS
aws rds create-db-snapshot \
  --db-instance-identifier djdip-db \
  --db-snapshot-identifier djdip-backup-$(date +%Y%m%d)
```

### 6. Configure CDN

#### Azure CDN

```bash
az cdn profile create \
  --resource-group djdip-rg \
  --name djdip-cdn

az cdn endpoint create \
  --resource-group djdip-rg \
  --profile-name djdip-cdn \
  --name djdip-static \
  --origin your-storage-account.blob.core.windows.net
```

#### CloudFront (AWS)

```bash
aws cloudfront create-distribution \
  --origin-domain-name your-s3-bucket.s3.amazonaws.com
```

## Monitoring and Maintenance

### Health Monitoring

Set up uptime monitoring with:
- UptimeRobot (free)
- Pingdom
- StatusCake
- Azure Application Insights
- AWS CloudWatch

Example health check script:

```bash
#!/bin/bash
HEALTH_URL="https://api.yourdomain.com/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -ne 200 ]; then
    echo "Health check failed! Status: $RESPONSE"
    # Send alert (email, Slack, etc.)
fi
```

### Log Management

- Azure: Application Insights, Log Analytics
- AWS: CloudWatch Logs
- Google Cloud: Cloud Logging
- Self-hosted: ELK Stack, Graylog

### Performance Monitoring

Monitor these metrics:
- Response time
- Error rate
- Database query performance
- Memory usage
- CPU usage
- Request throughput

### Regular Maintenance Tasks

**Daily**:
- Check error logs
- Monitor resource usage
- Verify backups completed

**Weekly**:
- Review security alerts
- Check for dependency updates
- Review performance metrics

**Monthly**:
- Update dependencies
- Review and optimize database
- Test disaster recovery
- Security audit

### Scaling Strategies

#### Vertical Scaling (Increase resources)

```bash
# Azure
az appservice plan update \
  --name djdip-plan \
  --sku P1V2

# AWS
eb scale 2  # Increase instance count
```

#### Horizontal Scaling (Add instances)

```bash
# Azure
az appservice plan update \
  --name djdip-plan \
  --number-of-workers 3

# AWS EB Autoscaling
eb scale 1-5  # Min-Max instances
```

## Troubleshooting

### Application Won't Start

1. Check logs
2. Verify environment variables
3. Test database connection
4. Check firewall rules

### Slow Performance

1. Enable caching (Redis)
2. Optimize database queries
3. Use CDN for static assets
4. Enable compression
5. Scale resources

### Database Connection Issues

1. Verify connection string
2. Check firewall rules
3. Verify SSL configuration
4. Check connection limits

## Cost Optimization

### Tips

1. Use auto-scaling (scale down during low traffic)
2. Use spot/preemptible instances for non-critical workloads
3. Enable caching to reduce database load
4. Use CDN to reduce bandwidth costs
5. Monitor and right-size resources
6. Use reserved instances for predictable workloads

### Estimated Monthly Costs

**Small Deployment** (< 10K users):
- Azure: $50-150/month
- AWS: $60-180/month
- DigitalOcean: $40-120/month
- Google Cloud: $50-150/month

**Medium Deployment** (10K-100K users):
- Azure: $200-500/month
- AWS: $250-600/month
- Google Cloud: $200-500/month

## Support and Resources

- [DOCKER-DEPLOYMENT.md](./DOCKER-DEPLOYMENT.md) - Docker deployment guide
- [DEPLOYMENT-CHECKLIST.md](./Documentation/DEPLOYMENT-CHECKLIST.md) - Detailed checklist
- [TROUBLESHOOTING.md](./Documentation/TROUBLESHOOTING.md) - Common issues

---

**Last Updated**: 2025-11-17
