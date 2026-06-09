# Production Deployment Checklist

Complete checklist for deploying DJ-DiP to production.

---

## 🔐 Pre-Deployment Security

### Environment Variables

- [ ] Change JWT secret to strong random value (32+ characters)
- [ ] Update database connection string for production
- [ ] Set `ASPNETCORE_ENVIRONMENT` to `Production`
- [ ] Configure CORS for production frontend URL
- [ ] Set secure cookie settings
- [ ] Enable HTTPS redirect
- [ ] Configure rate limiting

**appsettings.Production.json**:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=your-db-host;Database=djdip;Username=user;Password=pass"
  },
  "JwtSettings": {
    "Secret": "generate-a-strong-32-character-secret-key",
    "Issuer": "https://api.djdip.com",
    "Audience": "https://djdip.com",
    "ExpirationMinutes": 15,
    "RefreshExpirationDays": 7
  },
  "AllowedOrigins": [
    "https://djdip.com",
    "https://www.djdip.com"
  ]
}
```

### Security Headers

- [ ] Add HSTS (HTTP Strict Transport Security)
- [ ] Add X-Content-Type-Options: nosniff
- [ ] Add X-Frame-Options: DENY
- [ ] Add Content-Security-Policy
- [ ] Add X-XSS-Protection

**Program.cs**:
```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Add("X-Frame-Options", "DENY");
    context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Add("Content-Security-Policy", "default-src 'self'");
    await next();
});

app.UseHsts();
app.UseHttpsRedirection();
```

### SSL/TLS

- [ ] Obtain SSL certificate (Let's Encrypt or commercial)
- [ ] Configure HTTPS in production
- [ ] Redirect HTTP to HTTPS
- [ ] Enable TLS 1.2+ only

---

## 🗄️ Database Setup

### Production Database

- [ ] Choose database provider (PostgreSQL recommended)
- [ ] Set up database server
- [ ] Create database and user
- [ ] Configure connection string
- [ ] Enable SSL connection

**For PostgreSQL**:
```bash
# Install provider
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL

# Update DbContext configuration
services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(Configuration.GetConnectionString("DefaultConnection")));
```

### Run Migrations

```bash
# Create migration bundle
dotnet ef migrations bundle --self-contained -r linux-x64

# Or run directly
dotnet ef database update --connection "your-production-connection-string"
```

### Database Backup

- [ ] Set up automated daily backups
- [ ] Test backup restoration
- [ ] Document backup procedures
- [ ] Set up monitoring for backup failures

---

## 🚀 Backend Deployment

### Build & Publish

```bash
# Build for production
dotnet publish -c Release -o ./publish

# Verify build
cd publish
ls -la
```

### Deployment Options

#### Option 1: Azure App Service

```bash
# Install Azure CLI
az login
az webapp create --resource-group myResourceGroup --plan myAppServicePlan --name djdip-api

# Deploy
az webapp up --name djdip-api --runtime "DOTNETCORE:8.0"
```

- [ ] Create App Service
- [ ] Configure application settings
- [ ] Set up deployment slots (staging/production)
- [ ] Configure auto-scaling
- [ ] Set up Application Insights

#### Option 2: Docker + Kubernetes

**Dockerfile**:
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["DJDiP.csproj", "./"]
RUN dotnet restore
COPY . .
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "DJDiP.dll"]
```

```bash
# Build Docker image
docker build -t djdip-api:latest .

# Run locally to test
docker run -p 8080:80 djdip-api:latest

# Push to container registry
docker tag djdip-api:latest your-registry.azurecr.io/djdip-api:latest
docker push your-registry.azurecr.io/djdip-api:latest
```

- [ ] Create Docker image
- [ ] Push to container registry
- [ ] Create Kubernetes deployment
- [ ] Configure ingress
- [ ] Set up health checks

#### Option 3: AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p "64bit Amazon Linux 2 v2.6.0 running .NET 8" djdip-api

# Create environment
eb create djdip-production

# Deploy
eb deploy
```

- [ ] Create Elastic Beanstalk application
- [ ] Configure environment variables
- [ ] Set up RDS database
- [ ] Configure auto-scaling
- [ ] Set up CloudWatch monitoring

---

## 🌐 Frontend Deployment

### Build

```bash
cd Frontend

# Update API endpoint
# Edit src/apollo-client.ts
const httpLink = createHttpLink({
  uri: 'https://api.djdip.com/graphql',
});

# Build
npm run build

# Verify build
cd dist
ls -la
```

### Deployment Options

#### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd Frontend
vercel --prod
```

- [ ] Connect GitHub repository
- [ ] Configure environment variables
- [ ] Set up custom domain
- [ ] Enable edge caching
- [ ] Configure redirects

**vercel.json**:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

#### Option 2: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd Frontend
netlify deploy --prod --dir=dist
```

- [ ] Connect GitHub repository
- [ ] Configure build settings
- [ ] Set up custom domain
- [ ] Enable CDN
- [ ] Configure redirects

**netlify.toml**:
```toml
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Option 3: AWS S3 + CloudFront

```bash
# Create S3 bucket
aws s3 mb s3://djdip-frontend

# Upload files
aws s3 sync ./dist s3://djdip-frontend --delete

# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name djdip-frontend.s3.amazonaws.com
```

- [ ] Create S3 bucket
- [ ] Enable static website hosting
- [ ] Create CloudFront distribution
- [ ] Configure custom domain
- [ ] Set up SSL certificate
- [ ] Configure cache behaviors

---

## 📧 Email Configuration

### Email Service Setup

- [ ] Choose email provider (SendGrid, AWS SES, Mailgun)
- [ ] Configure SMTP settings
- [ ] Verify sender domain
- [ ] Create email templates
- [ ] Test email delivery

**SendGrid Example**:
```csharp
// appsettings.Production.json
"EmailSettings": {
  "ApiKey": "your-sendgrid-api-key",
  "FromEmail": "noreply@djdip.com",
  "FromName": "DJ-DiP"
}

// Email service implementation
public class EmailService : IEmailService
{
    private readonly SendGridClient _client;

    public EmailService(IConfiguration configuration)
    {
        var apiKey = configuration["EmailSettings:ApiKey"];
        _client = new SendGridClient(apiKey);
    }

    public async Task SendWelcomeEmailAsync(string email, string name)
    {
        var from = new EmailAddress("noreply@djdip.com", "DJ-DiP");
        var to = new EmailAddress(email, name);
        var subject = "Welcome to DJ-DiP!";
        var content = $"<p>Hi {name},</p><p>Welcome to DJ-DiP...</p>";

        var msg = MailHelper.CreateSingleEmail(from, to, subject, "", content);
        await _client.SendEmailAsync(msg);
    }
}
```

### Email Templates

- [ ] Welcome email
- [ ] Ticket confirmation
- [ ] Subscription confirmation
- [ ] Password reset
- [ ] Event reminder (24 hours before)
- [ ] Badge unlock notification
- [ ] Level up notification

---

## 💳 Stripe Integration

### Stripe Setup

```bash
# Install Stripe.NET
dotnet add package Stripe.net
```

- [ ] Create Stripe account
- [ ] Get API keys (test and live)
- [ ] Create products for subscription tiers
- [ ] Set up webhooks
- [ ] Test payment flow

**Configuration**:
```csharp
// appsettings.Production.json
"Stripe": {
  "SecretKey": "sk_live_...",
  "PublishableKey": "pk_live_...",
  "WebhookSecret": "whsec_...",
  "PlusProductId": "prod_...",
  "PremiumProductId": "prod_..."
}

// Startup configuration
StripeConfiguration.ApiKey = Configuration["Stripe:SecretKey"];
```

### Webhook Handling

```csharp
[HttpPost("api/stripe/webhook")]
public async Task<IActionResult> HandleWebhook()
{
    var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
    var stripeSignature = Request.Headers["Stripe-Signature"];

    try
    {
        var stripeEvent = EventUtility.ConstructEvent(
            json,
            stripeSignature,
            _configuration["Stripe:WebhookSecret"]
        );

        switch (stripeEvent.Type)
        {
            case "customer.subscription.created":
                await HandleSubscriptionCreated(stripeEvent);
                break;
            case "customer.subscription.updated":
                await HandleSubscriptionUpdated(stripeEvent);
                break;
            case "customer.subscription.deleted":
                await HandleSubscriptionDeleted(stripeEvent);
                break;
            case "invoice.payment_succeeded":
                await HandlePaymentSucceeded(stripeEvent);
                break;
            case "invoice.payment_failed":
                await HandlePaymentFailed(stripeEvent);
                break;
        }

        return Ok();
    }
    catch (StripeException e)
    {
        return BadRequest(e.Message);
    }
}
```

- [ ] Set up webhook endpoint
- [ ] Verify webhook signatures
- [ ] Handle subscription.created
- [ ] Handle subscription.updated
- [ ] Handle subscription.deleted
- [ ] Handle payment_succeeded
- [ ] Handle payment_failed
- [ ] Test webhooks with Stripe CLI

---

## 📊 Monitoring & Logging

### Application Insights (Azure)

```csharp
// Install package
dotnet add package Microsoft.ApplicationInsights.AspNetCore

// Configure in Program.cs
builder.Services.AddApplicationInsightsTelemetry();
```

- [ ] Set up Application Insights
- [ ] Configure instrumentation key
- [ ] Set up alerts for errors
- [ ] Create dashboards
- [ ] Monitor performance
- [ ] Track custom events

### Sentry (Error Tracking)

```csharp
// Install package
dotnet add package Sentry.AspNetCore

// Configure in Program.cs
builder.Services.AddSentry(options =>
{
    options.Dsn = "https://...@sentry.io/...";
    options.TracesSampleRate = 1.0;
    options.Environment = builder.Environment.EnvironmentName;
});
```

- [ ] Create Sentry project
- [ ] Configure DSN
- [ ] Set up error alerts
- [ ] Configure release tracking
- [ ] Test error reporting

### Structured Logging

```csharp
// Use Serilog
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File

// Configure
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .WriteTo.File("logs/djdip-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();
```

- [ ] Configure structured logging
- [ ] Set up log aggregation
- [ ] Configure log retention
- [ ] Set up log alerts

---

## 🔍 Health Checks

### Configure Health Checks

```csharp
// Add health checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>()
    .AddUrlGroup(new Uri("https://api.stripe.com"), "Stripe API")
    .AddCheck("Email Service", () =>
    {
        // Check email service connectivity
        return HealthCheckResult.Healthy();
    });

// Add health check endpoint
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

- [ ] Add database health check
- [ ] Add external API health checks
- [ ] Add /health endpoint
- [ ] Add /health/ready endpoint
- [ ] Configure health check monitoring

---

## 🚨 Performance Optimization

### Backend

- [ ] Enable response compression
- [ ] Configure output caching
- [ ] Optimize database queries
- [ ] Add database indexes
- [ ] Use connection pooling
- [ ] Enable query result caching

```csharp
// Response compression
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});

// Output caching
builder.Services.AddOutputCache();
app.UseOutputCache();
```

### Frontend

- [ ] Enable code splitting
- [ ] Lazy load routes
- [ ] Optimize images
- [ ] Enable browser caching
- [ ] Use CDN for static assets
- [ ] Minimize bundle size

```bash
# Analyze bundle
npm run build -- --analyze

# Check bundle size
npm install -g bundlesize
bundlesize
```

---

## 🧪 Testing

### Pre-Production Testing

- [ ] Run all unit tests
- [ ] Run integration tests
- [ ] Test all API endpoints
- [ ] Test authentication flows
- [ ] Test subscription flows
- [ ] Test payment processing
- [ ] Test email delivery
- [ ] Load testing
- [ ] Security testing

### Load Testing

```bash
# Install k6
brew install k6

# Run load test
k6 run loadtest.js
```

**loadtest.js**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 100,
  duration: '5m',
};

export default function () {
  let res = http.get('https://api.djdip.com/graphql');
  check(res, { 'status was 200': (r) => r.status == 200 });
  sleep(1);
}
```

---

## 📋 Post-Deployment

### Verification

- [ ] Test homepage loads
- [ ] Test user registration
- [ ] Test login
- [ ] Test event browsing
- [ ] Test ticket purchase
- [ ] Test subscription purchase
- [ ] Test review submission
- [ ] Test follow DJ
- [ ] Check all API endpoints
- [ ] Verify email delivery
- [ ] Check error logging
- [ ] Verify database connections

### Monitoring Setup

- [ ] Set up uptime monitoring (Pingdom, UptimeRobot)
- [ ] Configure alert notifications (Slack, PagerDuty)
- [ ] Set up performance monitoring
- [ ] Configure error rate alerts
- [ ] Set up security monitoring

### Documentation

- [ ] Update API documentation
- [ ] Document deployment procedures
- [ ] Create runbook for common issues
- [ ] Document rollback procedures
- [ ] Update architecture diagrams

---

## 🔄 CI/CD Setup

### GitHub Actions

**.github/workflows/deploy.yml**:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup .NET
        uses: actions/setup-dotnet@v1
        with:
          dotnet-version: 8.0.x
      - name: Build
        run: dotnet build -c Release
      - name: Test
        run: dotnet test
      - name: Publish
        run: dotnet publish -c Release -o ./publish
      - name: Deploy to Azure
        uses: azure/webapps-deploy@v2
        with:
          app-name: djdip-api
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: ./publish

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: 18
      - name: Install
        working-directory: ./Frontend
        run: npm ci
      - name: Build
        working-directory: ./Frontend
        run: npm run build
      - name: Deploy to Vercel
        working-directory: ./Frontend
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

- [ ] Set up GitHub Actions
- [ ] Configure deployment secrets
- [ ] Set up staging environment
- [ ] Configure automatic deployments
- [ ] Set up rollback capability

---

## ✅ Final Checklist

### Security
- [ ] All secrets in environment variables
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured

### Database
- [ ] Production database created
- [ ] Migrations applied
- [ ] Backups configured
- [ ] Connection pooling enabled
- [ ] Indexes created

### Backend
- [ ] Application deployed
- [ ] Health checks working
- [ ] Logging configured
- [ ] Error tracking active
- [ ] Performance monitoring enabled

### Frontend
- [ ] Application deployed
- [ ] CDN enabled
- [ ] Custom domain configured
- [ ] SSL certificate installed
- [ ] Analytics configured

### Integrations
- [ ] Stripe configured
- [ ] Email service working
- [ ] Webhooks configured
- [ ] External APIs tested

### Monitoring
- [ ] Uptime monitoring active
- [ ] Error alerts configured
- [ ] Performance monitoring enabled
- [ ] Log aggregation working
- [ ] Dashboards created

### Documentation
- [ ] API documentation updated
- [ ] Deployment guide complete
- [ ] Runbook created
- [ ] Team onboarded

---

## 🎉 Go Live!

Once all checklist items are complete:

1. **Announce Launch**
   - Press release
   - Social media
   - Email to waitlist

2. **Monitor Closely**
   - Watch error rates
   - Monitor performance
   - Check user feedback
   - Track key metrics

3. **Iterate**
   - Fix bugs quickly
   - Gather user feedback
   - Plan next features
   - Optimize based on data

**Congratulations on your production deployment!** 🚀
