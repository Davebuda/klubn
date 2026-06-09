# DJ-DiP Quick Start Guide

Get your DJ event platform running in minutes!

---

## 🚀 Quick Setup (5 Minutes)

### Backend Setup

```bash
# 1. Navigate to project
cd DJ-DiP

# 2. Restore packages
dotnet restore

# 3. Create database
dotnet ef database update

# 4. Run backend
dotnet run

# ✅ Backend running at: https://localhost:5001/graphql
```

### Frontend Setup

```bash
# 1. Navigate to frontend
cd Frontend

# 2. Install dependencies (if not already done)
npm install

# 3. Start development server
npm run dev

# ✅ Frontend running at: http://localhost:5173
```

**That's it!** You now have a fully functional DJ event platform running locally.

---

## 📱 Test the Features

### 1. Create an Account
- Go to http://localhost:5173/register
- Create a user account
- Login with your credentials

### 2. Browse Events
- Click "Events" in navigation
- View event details
- Add tickets to cart

### 3. Follow a DJ
- Browse to "DJs" page
- Click on a DJ profile
- Click "Follow" button
- See follower count update

### 4. Leave a Review
- Go to an event detail page
- Scroll to "Event Reviews"
- Click "Write a Review"
- Submit 5-star rating and comment

### 5. Check Subscription Tiers
- Go to "/subscription"
- View Free, Plus ($9.99), Premium ($19.99) tiers
- See features and benefits
- Subscribe to a tier (mock payment for now)

### 6. View Your Dashboard
- Click "Dashboard" in navigation
- See your tickets
- View followed DJs
- Check subscription status

---

## 🔧 Configuration

### Backend Configuration

**appsettings.json**:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=djdip.db"
  },
  "JwtSettings": {
    "Secret": "your-secret-key-min-32-characters-long",
    "Issuer": "DJDiPAPI",
    "Audience": "DJDiPClient",
    "ExpirationMinutes": 15,
    "RefreshExpirationDays": 7
  }
}
```

### Frontend Configuration

**src/apollo-client.ts**:
```typescript
const httpLink = createHttpLink({
  uri: 'http://localhost:5001/graphql', // Update for production
});
```

---

## 📊 Admin Features

### GraphQL Playground

Access at: https://localhost:5001/graphql

**Create Price Rules (Admin Only)**:
```graphql
mutation {
  createPriceRule(input: {
    eventId: "your-event-id"
    type: EARLY_BIRD
    name: "Early Bird Special"
    discountPercentage: 15
    startDate: "2025-01-01T00:00:00Z"
    endDate: "2025-01-15T23:59:59Z"
  }) {
    id
    name
  }
}
```

---

## 🎮 Testing Gamification

### Award Points Manually

```graphql
# This requires backend integration
# Points are automatically awarded when:
# - User purchases tickets (+50 points)
# - User submits review (+25 points)
# - User follows DJ (+10 points)
```

### Check Leaderboard

```graphql
query {
  leaderboard(limit: 10) {
    userName
    totalPoints
    level
    levelName
  }
}
```

### View User Badges

```graphql
query {
  userBadges(userId: "your-user-id") {
    badge {
      name
      description
      rarity
    }
    earnedAt
  }
}
```

---

## 💡 Common Tasks

### Add Test Data

Run the DbInitializer to seed test data:
```csharp
// Already configured in Program.cs
// Creates sample events, DJs, genres, venues
```

### Reset Database

```bash
# Delete database file
rm djdip.db

# Recreate
dotnet ef database update
```

### Build for Production

**Backend**:
```bash
dotnet publish -c Release -o ./publish
```

**Frontend**:
```bash
npm run build
# Output in dist/
```

---

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check if port 5001 is in use
lsof -i :5001

# Update port in launchSettings.json if needed
```

### Frontend can't connect to API

1. Check backend is running
2. Verify CORS is configured in Program.cs
3. Check API URL in apollo-client.ts

### Database errors

```bash
# Drop and recreate database
dotnet ef database drop
dotnet ef database update
```

### Build errors

```bash
# Backend
dotnet clean
dotnet restore
dotnet build

# Frontend
rm -rf node_modules
npm install
npm run build
```

---

## 📚 API Examples

### User Registration

```graphql
mutation {
  register(input: {
    email: "user@example.com"
    password: "SecurePass123!"
    firstName: "John"
    lastName: "Doe"
  }) {
    accessToken
    user {
      id
      email
      firstName
    }
  }
}
```

### Create Subscription

```graphql
mutation {
  createSubscription(input: {
    tier: PREMIUM
  }) {
    id
    tier
    tierName
    price
    status
  }
}
```

### Calculate Dynamic Price

```graphql
query {
  calculatePrice(eventId: "event-id", quantity: 2) {
    basePrice
    finalPrice
    totalDiscount
    appliedDiscounts {
      name
      type
      amount
      percentage
    }
  }
}
```

### Follow DJ

```graphql
mutation {
  followDJ(input: {
    djId: "dj-id"
  }) {
    id
    djName
    followedAt
  }
}
```

### Create Review

```graphql
mutation {
  createReview(input: {
    eventId: "event-id"
    rating: 5
    comment: "Amazing event!"
  }) {
    id
    rating
    comment
    isVerifiedAttendee
  }
}
```

---

## 🎯 Next Steps

### For Development

1. **Integrate Stripe**
   ```bash
   dotnet add package Stripe.net
   ```

2. **Add Email Service**
   - Implement IEmailService
   - Configure SMTP settings

3. **Set Up CI/CD**
   - GitHub Actions
   - Azure DevOps
   - GitLab CI

### For Production

1. **Database Migration**
   - Switch from SQLite to PostgreSQL
   - Run migrations on production

2. **Environment Variables**
   - Set JWT secret
   - Configure connection strings
   - Set CORS origins

3. **Deploy**
   - Backend: Azure App Service, AWS Elastic Beanstalk, or Docker
   - Frontend: Vercel, Netlify, or AWS S3 + CloudFront

---

## 📖 Documentation

- [PROJECT-STATUS-COMPLETE.md](PROJECT-STATUS-COMPLETE.md) - Full project status
- [IMPLEMENTATION-COMPLETE.md](IMPLEMENTATION-COMPLETE.md) - Implementation details
- [PHASE-2-COMPLETE.md](PHASE-2-COMPLETE.md) - Social features
- [PHASES-3-4-COMPLETE-SUMMARY.md](PHASES-3-4-COMPLETE-SUMMARY.md) - Subscriptions & Gamification

---

## 🎉 Features Available

✅ User Authentication (JWT)
✅ Event Management
✅ Ticket Purchasing
✅ DJ Profiles
✅ Follow DJs
✅ Reviews & Ratings (5-star)
✅ Subscriptions (Free/Plus/Premium)
✅ Dynamic Pricing (5 rule types)
✅ Points & Levels (10 levels)
✅ Badges (12 types)
✅ Leaderboard
✅ Shopping Cart
✅ User Dashboard
✅ Dark Mode
✅ Responsive Design

---

## 💰 Monetization Ready

**Subscription Tiers**:
- Free: $0/month
- Plus: $9.99/month (10% discount, 24h early access)
- Premium: $19.99/month (20% discount, 48h early access, VIP perks)

**Dynamic Pricing**:
- Early bird discounts
- Group purchase deals
- Member tier discounts
- Flash sales
- Last-minute pricing

**Gamification**:
- Points drive engagement
- Badges encourage activities
- Leaderboard creates competition

---

## 🆘 Need Help?

1. Check the documentation files
2. Review GraphQL schema at /graphql
3. Check error logs in console
4. Review appsettings.json configuration

---

**You're all set!** Start building your DJ event community. 🎵🎉

For detailed implementation notes, see [IMPLEMENTATION-COMPLETE.md](IMPLEMENTATION-COMPLETE.md)
