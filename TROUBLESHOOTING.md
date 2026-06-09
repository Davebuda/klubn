# Troubleshooting Guide

Common issues and their solutions for the DJ-DiP platform.

---

## 🔧 Development Issues

### Backend won't start

#### Error: "Failed to bind to address"
```
System.IO.IOException: Failed to bind to address https://127.0.0.1:5001
```

**Solution**:
```bash
# Check if port is in use
lsof -i :5001

# Kill the process
kill -9 <PID>

# Or change port in launchSettings.json
```

#### Error: "No database provider configured"
```
InvalidOperationException: No database provider has been configured
```

**Solution**:
```csharp
// Verify in Program.cs
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));
```

#### Error: "JWT secret not configured"
```
InvalidOperationException: JWT Secret not configured
```

**Solution**:
```json
// Add to appsettings.json
{
  "JwtSettings": {
    "Secret": "your-secret-key-must-be-at-least-32-characters-long",
    "Issuer": "DJDiPAPI",
    "Audience": "DJDiPClient"
  }
}
```

### Database Issues

#### Error: "Table does not exist"
```
SqliteException: SQLite Error 1: 'no such table: Subscriptions'
```

**Solution**:
```bash
# Run migrations
dotnet ef migrations add InitialCreate
dotnet ef database update

# Or delete database and recreate
rm djdip.db
dotnet ef database update
```

#### Error: "Foreign key constraint failed"
```
SqliteException: SQLite Error 19: 'FOREIGN KEY constraint failed'
```

**Solution**:
```csharp
// Ensure related entities exist before creating
var user = await _unitOfWork.Users.GetByIdAsync(userId);
if (user == null)
    throw new InvalidOperationException("User not found");

// Then create the entity
```

#### Error: "Sequence contains no elements"
```
InvalidOperationException: Sequence contains no elements
```

**Solution**:
```csharp
// Use FirstOrDefault instead of First
var user = await _unitOfWork.Users.GetAllAsync()
    .ContinueWith(t => t.Result.FirstOrDefault(u => u.Id == userId));

if (user == null)
    throw new NotFoundException("User not found");
```

### GraphQL Issues

#### Error: "Type XYZ could not be resolved"
```
SchemaException: Unable to resolve type `SubscriptionTier`
```

**Solution**:
```csharp
// Ensure enum is properly exposed in GraphQL schema
// Add [GraphQLType] attribute if needed
[GraphQLType("SubscriptionTier")]
public enum SubscriptionTier
{
    Free = 0,
    Plus = 1,
    Premium = 2
}
```

#### Error: "Cannot return null for non-null field"
```
GraphQLException: Cannot return null for non-nullable field User.subscription
```

**Solution**:
```csharp
// Make field nullable in GraphQL
public Task<SubscriptionDto?> MySubscription([Service] SubscriptionService service)

// Or ensure it always returns a value
public Task<SubscriptionDto> MySubscription([Service] SubscriptionService service)
{
    // Return default/empty subscription if none exists
}
```

---

## 🌐 Frontend Issues

### Build Errors

#### Error: "Module not found"
```
Error: Cannot find module '@apollo/client'
```

**Solution**:
```bash
# Install missing dependencies
cd Frontend
npm install

# Or clean install
rm -rf node_modules package-lock.json
npm install
```

#### Error: "TypeScript compilation errors"
```
TS2305: Module '"@heroicons/react/24/outline"' has no exported member 'XIcon'
```

**Solution**:
```bash
# Update packages
npm update @heroicons/react

# Or check import names match package version
```

#### Error: "Cannot use import statement outside a module"
```
SyntaxError: Cannot use import statement outside a module
```

**Solution**:
```json
// Verify package.json has "type": "module"
{
  "type": "module"
}

// Or use .mjs extension for module files
```

### Runtime Errors

#### Error: "NetworkError: Failed to fetch"
```
ApolloError: NetworkError: Failed to fetch
```

**Solution**:
```typescript
// Check API URL in apollo-client.ts
const httpLink = createHttpLink({
  uri: 'http://localhost:5001/graphql', // Verify this URL
});

// Ensure backend is running
// Check CORS configuration in backend
```

#### Error: "Unauthorized" (401)
```
Response code: 401 (Unauthorized)
```

**Solution**:
```typescript
// Verify token is being sent
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  console.log('Token:', token); // Debug

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});

// Check token hasn't expired
// Try logging out and back in
```

#### Error: "Cannot read property 'X' of undefined"
```
TypeError: Cannot read property 'tier' of undefined
```

**Solution**:
```typescript
// Use optional chaining
const tier = subscription?.tier;

// Or provide default value
const tier = subscription?.tier || 'Free';

// Add loading checks
if (loading) return <div>Loading...</div>;
if (!data) return <div>No data</div>;
```

---

## 💳 Subscription Issues

### Subscription not created

**Symptoms**: CreateSubscription mutation returns but subscription doesn't appear

**Debug**:
```csharp
// Add logging in SubscriptionService
_logger.LogInformation($"Creating subscription for user {userId}, tier {tier}");

// Check database
// SELECT * FROM Subscriptions WHERE UserId = 'user-id';

// Verify SaveChangesAsync is called
await _unitOfWork.SaveChangesAsync();
```

**Common Causes**:
1. Transaction not committed
2. User ID mismatch
3. Validation error silently caught
4. Database constraint violation

### Subscription discount not applying

**Symptoms**: Dynamic pricing doesn't show member discount

**Debug**:
```csharp
// Add logging in DynamicPricingService
var subscription = await _unitOfWork.Subscriptions.GetActiveSubscriptionAsync(userId);
_logger.LogInformation($"User subscription: {subscription?.Tier ?? SubscriptionTier.Free}");

// Check if user ID is being passed
_logger.LogInformation($"Calculating price for user: {userId ?? "null"}");
```

**Common Causes**:
1. User ID not passed to calculatePrice query
2. Subscription status not Active
3. Subscription expired
4. User not authenticated

---

## 🎮 Gamification Issues

### Points not awarded

**Symptoms**: User performs action but points don't increase

**Debug**:
```csharp
// Add logging in PointsService
_logger.LogInformation($"Awarding {points} points to user {userId} for action {action}");

try
{
    await _unitOfWork.SaveChangesAsync();
    _logger.LogInformation("Points saved successfully");
}
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to save points");
}
```

**Common Causes**:
1. PointsService not injected in service
2. AwardPointsAsync not called
3. Exception thrown before SaveChanges
4. PointTransaction table missing

**Solution**:
```csharp
// Ensure service is registered
builder.Services.AddScoped<PointsService>();

// Inject in constructor
private readonly PointsService _pointsService;

public TicketService(IUnitOfWork unitOfWork, PointsService pointsService)
{
    _unitOfWork = unitOfWork;
    _pointsService = pointsService;
}

// Call after action
await _pointsService.AwardPointsAsync(userId, PointAction.TicketPurchase, "...", ticketId);
```

### Badges not unlocking

**Symptoms**: User meets criteria but badge not awarded

**Debug**:
```csharp
// Check if badges are initialized
var badges = await _unitOfWork.Badges.GetAllAsync();
_logger.LogInformation($"Total badges in system: {badges.Count()}");

// Check badge criteria
_logger.LogInformation($"User event count: {eventCount}, Required: {badge.RequiredCount}");

// Check if already awarded
var existing = await _unitOfWork.UserBadges.GetAllAsync();
var hasBadge = existing.Any(ub => ub.UserId == userId && ub.BadgeId == badgeId);
_logger.LogInformation($"User already has badge: {hasBadge}");
```

**Common Causes**:
1. Badges not initialized on startup
2. CheckAndAwardBadgesAsync not called
3. Criteria not met
4. Badge already awarded (duplicate prevention)

**Solution**:
```csharp
// Initialize badges on startup (Program.cs)
using (var scope = app.Services.CreateScope())
{
    var badgeService = scope.ServiceProvider.GetRequiredService<BadgeService>();
    await badgeService.InitializeBadgesAsync();
}

// Call after relevant actions
await _badgeService.CheckAndAwardBadgesAsync(
    userId,
    eventCount: await GetUserEventCountAsync(userId)
);
```

### Leaderboard not updating

**Symptoms**: Leaderboard shows stale data

**Debug**:
```csharp
// Check if points are being saved
var userPoints = await _unitOfWork.UserPoints.GetAllAsync();
_logger.LogInformation($"Total user points records: {userPoints.Count()}");

// Verify query
var leaderboard = await _unitOfWork.UserPoints.GetAllAsync()
    .ContinueWith(t => t.Result.OrderByDescending(up => up.TotalPoints).Take(100));
```

**Common Causes**:
1. Cache not invalidated
2. Points not saved to database
3. Query not ordering correctly

**Solution**:
```csharp
// Clear cache after point award
_cache.Remove("leaderboard");

// Or implement cache expiration
_cache.Set("leaderboard", leaderboard, TimeSpan.FromMinutes(5));
```

---

## 💰 Dynamic Pricing Issues

### Price calculation returns base price

**Symptoms**: No discounts applied even though rules exist

**Debug**:
```csharp
// Check if rules exist
var rules = await _unitOfWork.PriceRules.GetAllAsync();
var eventRules = rules.Where(pr => pr.EventId == eventId && pr.IsActive);
_logger.LogInformation($"Active rules for event: {eventRules.Count()}");

// Check date ranges
_logger.LogInformation($"Current time: {DateTime.UtcNow}");
_logger.LogInformation($"Rule start: {rule.StartDate}, Rule end: {rule.EndDate}");

// Check usage limits
_logger.LogInformation($"Rule uses: {rule.CurrentUses}/{rule.MaxUses}");
```

**Common Causes**:
1. No active price rules
2. Date range doesn't match current date
3. Usage limit exceeded
4. Quantity constraints not met

**Solution**:
```csharp
// Create test rule
var rule = new PriceRule
{
    EventId = eventId,
    Type = PriceRuleType.EarlyBird,
    DiscountPercentage = 20,
    StartDate = DateTime.UtcNow.AddDays(-1),
    EndDate = DateTime.UtcNow.AddDays(30),
    IsActive = true
};
await _unitOfWork.PriceRules.AddAsync(rule);
await _unitOfWork.SaveChangesAsync();
```

### Discounts stacking incorrectly

**Symptoms**: Final price is too low or negative

**Debug**:
```csharp
// Log each discount applied
foreach (var discount in appliedDiscounts)
{
    _logger.LogInformation($"Applied: {discount.Name}, Amount: {discount.Amount}");
}
_logger.LogInformation($"Base: {basePrice}, Final: {finalPrice}, Total Discount: {totalDiscount}");
```

**Solution**:
```csharp
// Ensure minimum price
result.FinalPrice = Math.Max(result.FinalPrice, 0);

// Or limit discount stacking
if (result.TotalDiscount > result.BasePrice * 0.5m) // Max 50% off
{
    result.TotalDiscount = result.BasePrice * 0.5m;
    result.FinalPrice = result.BasePrice * 0.5m;
}
```

---

## 🔐 Authentication Issues

### JWT token expired

**Symptoms**: Requests return 401 after some time

**Solution**:
```typescript
// Implement token refresh
import { REFRESH_TOKEN } from './graphql/queries';

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const { data } = await apolloClient.mutate({
      mutation: REFRESH_TOKEN,
      variables: { refreshToken }
    });

    const newAccessToken = data.refreshToken.accessToken;
    localStorage.setItem('token', newAccessToken);
    return newAccessToken;
  } catch (error) {
    // Refresh token expired, logout user
    localStorage.clear();
    window.location.href = '/login';
    return null;
  }
};

// Use in Apollo error link
import { onError } from '@apollo/client/link/error';

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    for (let err of graphQLErrors) {
      if (err.extensions?.code === 'UNAUTHENTICATED') {
        return fromPromise(
          refreshAccessToken().then(newToken => {
            if (newToken) {
              operation.setContext({
                headers: {
                  ...operation.getContext().headers,
                  authorization: `Bearer ${newToken}`,
                }
              });
              return forward(operation);
            }
          })
        );
      }
    }
  }
});
```

### User not authenticated in ClaimsPrincipal

**Symptoms**: User ID is null in GraphQL resolvers

**Debug**:
```csharp
var userId = claimsPrincipal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
_logger.LogInformation($"User ID from claims: {userId ?? "null"}");
_logger.LogInformation($"User authenticated: {claimsPrincipal.Identity?.IsAuthenticated}");

// Log all claims
foreach (var claim in claimsPrincipal.Claims)
{
    _logger.LogInformation($"Claim: {claim.Type} = {claim.Value}");
}
```

**Common Causes**:
1. Token not sent in Authorization header
2. Token format incorrect
3. JWT validation failed
4. User ID claim missing

**Solution**:
```csharp
// Ensure claims are added when creating token
var claims = new[]
{
    new Claim(ClaimTypes.NameIdentifier, user.Id),
    new Claim(ClaimTypes.Email, user.Email),
    new Claim(ClaimTypes.Role, user.Role.ToString()),
    new Claim(JwtRegisteredClaimNames.Sub, user.Id),
};

// Verify token validation parameters
options.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuerSigningKey = true,
    IssuerSigningKey = new SymmetricSecurityKey(key),
    ValidateIssuer = true,
    ValidIssuer = jwtSettings.Issuer,
    ValidateAudience = true,
    ValidAudience = jwtSettings.Audience,
    ValidateLifetime = true,
    ClockSkew = TimeSpan.Zero
};
```

---

## 🐛 Common Error Messages

### "Object reference not set to an instance of an object"
**Cause**: Null reference
**Solution**: Add null checks, use optional chaining

### "The instance of entity type cannot be tracked"
**Cause**: Entity tracking conflict
**Solution**: Use AsNoTracking() for read-only queries

### "A task was canceled"
**Cause**: Request timeout
**Solution**: Increase timeout, optimize query

### "The JSON value could not be converted"
**Cause**: Type mismatch in JSON deserialization
**Solution**: Check DTO properties match GraphQL types

### "Value cannot be null. (Parameter 'source')"
**Cause**: LINQ operation on null collection
**Solution**: Initialize collections, add null checks

---

## 🔍 Debugging Tips

### Enable Detailed Logging

**appsettings.Development.json**:
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore": "Information"
    }
  }
}
```

### Use Debugger

```csharp
// Visual Studio / Rider: Set breakpoints
// VS Code: Use launch.json

// Or add debug output
System.Diagnostics.Debugger.Break();
```

### GraphQL Playground

```graphql
# Test queries directly at https://localhost:5001/graphql

# Add Authorization header
{
  "Authorization": "Bearer your-token-here"
}

# Test mutation
mutation {
  createSubscription(input: { tier: PLUS }) {
    id
    tier
    status
  }
}
```

### Database Inspection

```bash
# SQLite
sqlite3 djdip.db
.tables
SELECT * FROM Subscriptions;
SELECT * FROM UserPoints ORDER BY TotalPoints DESC LIMIT 10;

# Or use DB Browser for SQLite (GUI)
```

### Network Inspection

```bash
# Chrome DevTools → Network tab
# Filter: GraphQL
# Check request/response

# Or use Postman
POST https://localhost:5001/graphql
Headers: Authorization: Bearer <token>
Body: {"query": "query { events { id title } }"}
```

---

## 📞 Getting Help

If you're still stuck:

1. **Check Documentation**
   - [IMPLEMENTATION-COMPLETE.md](IMPLEMENTATION-COMPLETE.md)
   - [INTEGRATION-GUIDE.md](INTEGRATION-GUIDE.md)
   - [QUICK-START-GUIDE.md](QUICK-START-GUIDE.md)

2. **Search Issues**
   - Look for error message online
   - Check Stack Overflow
   - Search GitHub issues

3. **Enable Debug Logging**
   - Increase log level to Debug
   - Check all error logs
   - Look for stack traces

4. **Simplify**
   - Remove complexity
   - Test in isolation
   - Use minimal example

5. **Ask for Help**
   - Provide error message
   - Share relevant code
   - Describe what you tried
   - Include versions

---

**Most issues are caused by:**
1. Missing configuration
2. Null reference errors
3. Authentication/authorization
4. Database state issues
5. Type mismatches

**First steps for any issue:**
1. Check logs
2. Verify configuration
3. Test in isolation
4. Add debug output
5. Check database state

Good luck debugging! 🐛🔧
