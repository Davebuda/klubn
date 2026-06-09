# DJ-DiP (KlubN) - Comprehensive Developer Documentation

**Version**: 1.0.0
**Last Updated**: November 5, 2025
**Authors**: Development Team
**Target Audience**: Developers, DevOps Engineers, Technical Leads

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture & Design Patterns](#3-architecture--design-patterns)
4. [Backend Documentation](#4-backend-documentation)
5. [Frontend Documentation](#5-frontend-documentation)
6. [GraphQL API Layer](#6-graphql-api-layer)
7. [Database Schema](#7-database-schema)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [External Services & Integrations](#9-external-services--integrations)
10. [Deployment & Infrastructure](#10-deployment--infrastructure)
11. [Development Workflow](#11-development-workflow)
12. [Testing Strategy](#12-testing-strategy)
13. [Security Considerations](#13-security-considerations)
14. [Performance Optimization](#14-performance-optimization)
15. [Troubleshooting & FAQ](#15-troubleshooting--faq)

---

## 1. Project Overview

### 1.1 What is DJ-DiP (KlubN)?

DJ-DiP is a comprehensive **event ticketing and DJ management platform** designed for the electronic music industry. It combines event management, ticketing, DJ profiles, media galleries, and premium subscription services into a unified platform.

### 1.2 Key Features

**For Event Organizers:**
- Event creation and management
- Venue management
- DJ lineup coordination
- Dynamic ticket pricing
- QR code ticket validation
- Order and payment tracking
- Promotion code system

**For DJs:**
- Professional profile pages
- Top 10 track lists
- Social media integration
- Service offerings (bookings, equipment rental)
- Follower system
- Media gallery

**For Attendees:**
- Browse and search events
- Purchase tickets
- Mobile wallet integration (Apple Wallet, Google Pay)
- Event reviews and ratings
- Photo/video gallery
- Premium subscriptions (Free, Plus, Premium)
- Gamification (points and badges)
- Push notifications (PWA)

### 1.3 Business Model

**Revenue Streams:**
1. Ticket sales (commission-based)
2. Premium subscriptions (monthly/annual)
3. DJ service bookings
4. Promotion/advertising placements

### 1.4 Project Statistics

```
Lines of Code: ~50,000+
Backend: ~25,000 lines (C#)
Frontend: ~20,000 lines (TypeScript/React)
Database Tables: 33
Domain Models: 33
Services: 28
DTOs: 75+
GraphQL Operations: 120+ (50 queries, 70 mutations)
Pages: 28
Components: 15+
```

---

## 2. Technology Stack

### 2.1 Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **ASP.NET Core** | 8.0 | Web API framework |
| **C#** | 12.0 | Programming language |
| **Entity Framework Core** | 9.0.10 | ORM for database access |
| **HotChocolate** | 13.9.7 | GraphQL server |
| **SQLite** | - | Development database |
| **SQL Server** | - | Production database |
| **JWT Bearer** | 8.0.0 | Authentication |
| **BCrypt.Net** | 4.0.3 | Password hashing |
| **WebPush** | 1.0.12 | Push notifications |

**Key NuGet Packages:**
```xml
<PackageReference Include="HotChocolate.AspNetCore" Version="13.9.7" />
<PackageReference Include="HotChocolate.AspNetCore.Authorization" Version="13.9.7" />
<PackageReference Include="HotChocolate.Data.EntityFramework" Version="13.9.7" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="9.0.10" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
<PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
<PackageReference Include="WebPush" Version="1.0.12" />
```

### 2.2 Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI framework |
| **TypeScript** | 5.9.3 | Type-safe JavaScript |
| **Vite** | 7.1.11 | Build tool and dev server |
| **Apollo Client** | 3.14.0 | GraphQL client |
| **React Router** | 7.9.4 | Client-side routing |
| **Zustand** | 5.0.8 | State management |
| **Tailwind CSS** | 3.4.18 | Utility-first CSS |
| **React Hook Form** | 7.65.0 | Form handling |
| **Zod** | 4.1.12 | Schema validation |

**Key npm Packages:**
```json
{
  "@apollo/client": "^3.14.0",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.9.4",
  "zustand": "^5.0.8",
  "tailwindcss": "^3.4.18",
  "@headlessui/react": "^2.2.9",
  "@heroicons/react": "^2.2.0",
  "react-hook-form": "^7.65.0",
  "zod": "^4.1.12"
}
```

### 2.3 Development Tools

| Tool | Purpose |
|------|---------|
| **Visual Studio Code** | Primary IDE |
| **Git** | Version control |
| **Postman** | API testing |
| **GraphQL Playground** | GraphQL query testing (built-in) |
| **SQLite Browser** | Database inspection |
| **Chrome DevTools** | Frontend debugging |

---

## 3. Architecture & Design Patterns

### 3.1 Clean Architecture Overview

The project follows **Clean Architecture** (also known as Onion Architecture) with clear separation of concerns:

```
┌─────────────────────────────────────┐
│         API Layer (GraphQL)         │  ← External interface
├─────────────────────────────────────┤
│      Infrastructure Layer           │  ← Data access, external services
├─────────────────────────────────────┤
│      Application Layer              │  ← Business logic, services, DTOs
├─────────────────────────────────────┤
│      Domain Layer (Core)            │  ← Entities, value objects
└─────────────────────────────────────┘
```

**Key Principles:**
- Dependencies point inward (toward Domain)
- Domain layer has zero external dependencies
- Business rules isolated from infrastructure concerns
- Easy to test, maintain, and extend

### 3.2 Project Structure

```
DJ-DiP/
├── Domain/                    # Core business entities
│   └── Models/               # 33 domain models
│       ├── User.cs
│       ├── Event.cs
│       ├── DJProfile.cs
│       ├── Ticket.cs
│       └── ... (30+ more)
│
├── Application/              # Business logic layer
│   ├── Services/            # 28 service classes
│   │   ├── AuthenticationService.cs
│   │   ├── EventService.cs
│   │   ├── DJService.cs
│   │   └── ... (25+ more)
│   ├── DTO/                 # 75+ Data Transfer Objects
│   │   ├── EventDTO/
│   │   ├── DJDTO/
│   │   ├── AuthDTO/
│   │   └── ... (20+ folders)
│   ├── Interfaces/          # Service interfaces
│   │   ├── IEventService.cs
│   │   ├── IDJService.cs
│   │   ├── IRepository.cs
│   │   └── ... (30+ interfaces)
│   └── Settings/            # Configuration models
│       └── JwtSettings.cs
│
├── Infrastructure/          # Data access & external services
│   └── Persistance/
│       ├── AppDbContext.cs        # EF Core DbContext
│       ├── UnitOfWork.cs          # Transaction management
│       ├── Repositories/          # 18 repository classes
│       │   ├── Repository.cs      # Generic base
│       │   ├── EventRepository.cs
│       │   └── ... (17+ more)
│       └── Migrations/            # EF Core migrations
│
├── GraphQL/                 # API layer
│   ├── Query.cs            # 50+ GraphQL queries
│   ├── Mutation.cs         # 70+ GraphQL mutations
│   └── Authorization/      # Custom auth attributes
│       └── AuthorizeAttributes.cs
│
├── Frontend/               # React application
│   ├── src/
│   │   ├── pages/         # 28 page components
│   │   ├── components/    # 15+ reusable components
│   │   ├── graphql/       # GraphQL queries & mutations
│   │   ├── store/         # Zustand state management
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utility functions
│   │   └── App.tsx        # Main app & routing
│   ├── public/            # Static assets
│   │   ├── media/         # Images, videos
│   │   ├── manifest.json  # PWA manifest
│   │   └── service-worker.js
│   └── package.json
│
├── Program.cs             # Application entry point
├── appsettings.json       # Configuration
├── DJDIP.db              # SQLite database (dev)
└── README.md
```

### 3.3 Design Patterns Used

**1. Repository Pattern**
```csharp
// Generic repository for CRUD operations
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(object id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<T> AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(T entity);
}

// Entity-specific repository with custom queries
public interface IEventRepository : IRepository<Event>
{
    Task<IEnumerable<Event>> GetUpcomingEventsAsync();
    Task<IEnumerable<Event>> GetEventsByDateAsync(DateTime date);
}
```

**2. Unit of Work Pattern**
```csharp
public interface IUnitOfWork : IDisposable
{
    IEventRepository Events { get; }
    IDJProfileRepository DJProfiles { get; }
    ITicketRepository Tickets { get; }
    // ... other repositories

    Task<int> SaveChangesAsync();
}
```

**3. Service Layer Pattern**
```csharp
// Business logic encapsulated in services
public class EventService : IEventService
{
    private readonly IUnitOfWork _unitOfWork;

    public async Task<EventDetailDto> CreateEventAsync(CreateEventDto dto)
    {
        // Validation
        // Business rules
        // Data transformation
        // Persistence
    }
}
```

**4. DTO Pattern**
```csharp
// Separate DTOs for different operations
public class CreateEventDto { /* ... */ }
public class UpdateEventDto { /* ... */ }
public class ReadEventDto { /* ... */ }
public class ListEventDto { /* ... */ } // Lightweight for lists
public class DetailEventDto { /* ... */ } // Full details
```

**5. Dependency Injection**
```csharp
// Program.cs
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));
```

---

## 4. Backend Documentation

### 4.1 Domain Models (33 Total)

**Core Entities:**

#### User (ApplicationUser)
```csharp
public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; }          // Unique, required
    public string FullName { get; set; }
    public string PasswordHash { get; set; }   // BCrypt hashed
    public int Role { get; set; }              // 0=User, 1=DJ, 2=Admin
    public bool IsEmailVerified { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpires { get; set; }
    public Guid? CurrentSubscriptionId { get; set; }

    // Navigation properties
    public List<Order> Orders { get; set; }
    public List<Ticket> Tickets { get; set; }
    public List<Review> Reviews { get; set; }
    public Subscription? CurrentSubscription { get; set; }
}
```

#### Event
```csharp
public class Event
{
    public Guid Id { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public DateTime Date { get; set; }
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    public Guid VenueId { get; set; }

    // Navigation properties
    public Venue Venue { get; set; }
    public List<Genre> Genres { get; set; }        // Many-to-many
    public List<EventDJ> EventDJs { get; set; }    // DJ lineup
    public List<Ticket> Tickets { get; set; }
    public List<Review> Reviews { get; set; }
}
```

#### DJProfile
```csharp
public class DJProfile
{
    public Guid Id { get; set; }
    public string Name { get; set; }           // Stage name
    public string Bio { get; set; }            // Short bio
    public string LongBio { get; set; }        // Detailed bio
    public string Tagline { get; set; }
    public string Specialties { get; set; }    // JSON array
    public int YearsExperience { get; set; }
    public string InfluencedBy { get; set; }
    public string EquipmentUsed { get; set; }
    public string Achievements { get; set; }   // JSON array
    public string? SocialLinks { get; set; }   // JSON
    public string? ProfilePictureUrl { get; set; }

    // Navigation properties
    public List<Genre> Genres { get; set; }    // Many-to-many
    public List<EventDJ> EventDJs { get; set; }
    public List<DJTop10> DJTop10s { get; set; }
}
```

#### Ticket
```csharp
public class Ticket
{
    public Guid Id { get; set; }
    public string TicketNumber { get; set; }   // Unique
    public string QRCode { get; set; }         // Unique, base64
    public Guid EventId { get; set; }
    public Guid UserId { get; set; }
    public decimal Price { get; set; }
    public DateTime PurchaseDate { get; set; }
    public bool IsValid { get; set; }
    public bool IsUsed { get; set; }
    public DateTime? UsedDate { get; set; }
    public DateTime? CheckInTime { get; set; }

    // Wallet integration
    public string? WalletPassSerial { get; set; }
    public DateTime? WalletPassCreatedAt { get; set; }
    public string? GooglePayPassId { get; set; }

    // Navigation properties
    public Event Event { get; set; }
    public User User { get; set; }
}
```

**Complete Domain Model List:**

1. User (ApplicationUser)
2. Event
3. EventDJ (many-to-many join entity)
4. DJProfile
5. Venue
6. Genre
7. Ticket
8. Order
9. OrderItem
10. Payment
11. PromotionCode
12. Song
13. DJTop10
14. DJTop10List
15. ContactMessage
16. Newsletter
17. Notification
18. UserFollowDJ
19. Review
20. Subscription
21. PriceRule
22. UserPoints
23. PointTransaction
24. Badge
25. UserBadge
26. PushSubscription
27. SocialMediaLinks
28. MediaItem
29. MediaLike
30. MediaComment
31. Service
32. ServiceBooking
33. ServiceReview
34. SiteSetting

### 4.2 Application Services (28 Total)

**Service Responsibilities:**

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| **AuthenticationService** | User auth | `RegisterAsync`, `LoginAsync`, `RefreshTokenAsync` |
| **JwtTokenService** | JWT management | `GenerateAccessToken`, `GenerateRefreshToken`, `ValidateToken` |
| **UserService** | User CRUD | `GetAllAsync`, `GetByIdAsync`, `UpdateAsync`, `DeleteAsync` |
| **EventService** | Event management | `CreateAsync`, `UpdateAsync`, `GetUpcomingAsync` |
| **DJService** | DJ profiles | `CreateAsync`, `UpdateAsync`, `GetByIdAsync` |
| **VenueService** | Venue management | `CreateAsync`, `UpdateAsync`, `GetAllAsync` |
| **GenreService** | Genre management | `CreateAsync`, `UpdateAsync`, `GetAllAsync` |
| **TicketService** | Ticketing | `CreateAsync`, `ValidateAsync`, `ScanAsync`, `GenerateQRCode` |
| **OrderService** | Orders | `CreateOrderAsync`, `GetUserOrdersAsync`, `CalculateTotal` |
| **PaymentService** | Payments | `ProcessPaymentAsync`, `RefundAsync`, `GetByOrderIdAsync` |
| **PromotionCodeService** | Discounts | `ValidateCodeAsync`, `ApplyDiscountAsync`, `CreateAsync` |
| **SongService** | Music library | `CreateAsync`, `SearchByTitleAsync`, `SearchByArtistAsync` |
| **DJTop10Service** | Top tracks | `AddToTop10Async`, `UpdateRankAsync`, `GetDJTop10Async` |
| **ContactMessageService** | Contact forms | `CreateAsync`, `MarkAsReadAsync`, `GetAllAsync` |
| **NewsletterService** | Subscriptions | `SubscribeAsync`, `UnsubscribeAsync`, `GetActiveCountAsync` |
| **NotificationService** | Notifications | `CreateAsync`, `GetUserNotificationsAsync`, `MarkAsReadAsync` |
| **UserFollowService** | Following | `FollowDJAsync`, `UnfollowAsync`, `GetFollowingAsync` |
| **ReviewService** | Reviews | `CreateAsync`, `GetEventReviewsAsync`, `CalculateAverageRating` |
| **SubscriptionService** | Premium tiers | `CreateSubscriptionAsync`, `CancelAsync`, `GetCurrentAsync` |
| **DynamicPricingService** | Pricing | `CalculatePriceAsync`, `CreatePriceRuleAsync` |
| **PointsService** | Gamification | `AwardPointsAsync`, `GetUserPointsAsync` |
| **BadgeService** | Badges | `AwardBadgeAsync`, `GetUserBadgesAsync` |
| **WalletPassService** | Mobile wallets | `GenerateAppleWalletPassAsync`, `GenerateGooglePayPassAsync` |
| **PushNotificationService** | Push | `SubscribeAsync`, `SendNotificationAsync` |
| **MediaService** | Gallery | `UploadMediaAsync`, `GetPublicGalleryAsync`, `ToggleLikeAsync` |
| **MediaFileService** | File storage | `UploadFileAsync`, `GetSectionMediaAsync`, `DeleteFileAsync` |
| **ServiceService** | DJ services | `CreateServiceAsync`, `BookServiceAsync`, `ReviewServiceAsync` |
| **SiteSettingsService** | Site config | `GetSettingsAsync`, `UpdateSettingsAsync` |

**Example Service Implementation:**

```csharp
public class TicketService : ITicketService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<TicketService> _logger;

    public async Task<TicketDto> CreateAsync(CreateTicketDto dto)
    {
        // Generate unique ticket number
        var ticketNumber = GenerateTicketNumber();

        // Generate QR code
        var qrCode = GenerateQRCode(ticketNumber);

        // Calculate price (with dynamic pricing)
        var finalPrice = await _dynamicPricingService
            .CalculatePriceAsync(dto.EventId, dto.Quantity);

        // Create ticket
        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            TicketNumber = ticketNumber,
            QRCode = qrCode,
            EventId = dto.EventId,
            UserId = dto.UserId,
            Price = finalPrice,
            PurchaseDate = DateTime.UtcNow,
            IsValid = true,
            IsUsed = false
        };

        await _unitOfWork.Tickets.AddAsync(ticket);
        await _unitOfWork.SaveChangesAsync();

        return MapToDto(ticket);
    }

    public async Task<bool> ValidateAsync(string qrCode)
    {
        var ticket = await _unitOfWork.Tickets
            .FindAsync(t => t.QRCode == qrCode);

        if (ticket == null) return false;
        if (!ticket.IsValid) return false;
        if (ticket.IsUsed) return false;

        return true;
    }
}
```

### 4.3 Data Transfer Objects (DTOs)

**DTO Categories:**

1. **Auth DTOs** (5)
   - `RegisterDto`, `LoginDto`, `AuthResponseDto`, `RefreshTokenDto`, `ChangePasswordDto`

2. **Event DTOs** (7)
   - `CreateEventDto`, `UpdateEventDto`, `ReadEventDto`, `ListEventDto`, `DetailEventDto`, `EventSummaryDto`, `EventDjDto`

3. **DJ DTOs** (5)
   - `CreateDJProfileDto`, `UpdateDJProfileDto`, `DJProfileDetailsDto`, `DJProfileListItemDto`, `SocialMediaLinksDto`

4. **Ticket DTOs** (5)
   - `CreateTicketDto`, `TicketDto`, `ValidateTicketDto`, `ScanTicketDto`, `UpdateTicketStatusDto`

5. **Order DTOs** (3)
   - `CreateOrderDto`, `OrderDto`, `OrderDetailDto`

6. **Media DTOs** (4)
   - `MediaItemDto`, `MediaUploadDto`, `MediaFileDto`, `SectionMediaDto`

...(and 60+ more across other categories)

**DTO Design Principles:**

- **Separation of Concerns**: Different DTOs for Create/Update/Read operations
- **Data Validation**: Attributes for required fields, max length, etc.
- **GraphQL Compatibility**: DTOs map directly to GraphQL input/output types
- **No Business Logic**: DTOs are pure data containers

### 4.4 Repository Layer

**Generic Repository:**

```csharp
public class Repository<T> : IRepository<T> where T : class
{
    protected readonly AppDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public virtual async Task<T?> GetByIdAsync(object id)
        => await _dbSet.FindAsync(id);

    public virtual async Task<IEnumerable<T>> GetAllAsync()
        => await _dbSet.ToListAsync();

    public virtual async Task<T> AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        return entity;
    }

    public virtual async Task UpdateAsync(T entity)
    {
        _dbSet.Update(entity);
        await Task.CompletedTask;
    }

    public virtual async Task DeleteAsync(T entity)
    {
        _dbSet.Remove(entity);
        await Task.CompletedTask;
    }
}
```

**Entity-Specific Repository Example:**

```csharp
public class EventRepository : Repository<Event>, IEventRepository
{
    public override async Task<IEnumerable<Event>> GetAllAsync()
    {
        return await _dbSet
            .Include(e => e.Venue)
            .Include(e => e.Genres)
            .Include(e => e.EventDJs)
                .ThenInclude(edj => edj.DJ)
            .OrderBy(e => e.Date)
            .ToListAsync();
    }

    public async Task<IEnumerable<Event>> GetUpcomingEventsAsync()
    {
        var today = DateTime.UtcNow.Date;
        return await _dbSet
            .Include(e => e.Venue)
            .Include(e => e.Genres)
            .Where(e => e.Date >= today)
            .OrderBy(e => e.Date)
            .ToListAsync();
    }
}
```

### 4.5 Database Context

```csharp
public class AppDbContext : DbContext
{
    // DbSets (33 tables)
    public DbSet<Event> Events => Set<Event>();
    public DbSet<DJProfile> DJProfiles => Set<DJProfile>();
    public DbSet<User> ApplicationUsers => Set<User>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    // ... 29 more DbSets

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configure many-to-many relationships
        modelBuilder.Entity<EventDJ>()
            .HasKey(edj => new { edj.EventId, edj.DJId });

        modelBuilder.Entity<DJProfile>()
            .HasMany(dj => dj.Genres)
            .WithMany(g => g.DJProfiles)
            .UsingEntity(j => j.ToTable("DJProfileGenre"));

        // Configure delete behavior
        modelBuilder.Entity<Order>()
            .HasOne(o => o.User)
            .WithMany(u => u.Orders)
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Configure unique indexes
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<Ticket>()
            .HasIndex(t => t.QRCode)
            .IsUnique();
    }
}
```

---

## 5. Frontend Documentation

### 5.1 Project Structure

```
Frontend/
├── src/
│   ├── pages/              # Page components (28 pages)
│   │   ├── public/        # Public pages
│   │   │   ├── LandingPage.tsx
│   │   │   ├── EventsPage.tsx
│   │   │   ├── DJsPage.tsx
│   │   │   └── ...
│   │   ├── protected/     # Auth required
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── TicketsPage.tsx
│   │   │   └── ...
│   │   └── admin/         # Admin only
│   │       ├── AdminDashboard.tsx
│   │       ├── AdminEvents.tsx
│   │       └── ...
│   ├── components/        # Reusable components
│   │   ├── common/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Layout.tsx
│   │   ├── auth/
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── AdminRoute.tsx
│   │   ├── events/
│   │   │   ├── ReviewList.tsx
│   │   │   └── ReviewForm.tsx
│   │   └── ...
│   ├── graphql/          # GraphQL queries & mutations
│   │   └── queries.ts    # All GraphQL operations
│   ├── store/            # Zustand stores
│   │   ├── authStore.ts
│   │   ├── cartStore.ts
│   │   └── ...
│   ├── hooks/            # Custom hooks
│   │   ├── useAuth.ts
│   │   └── ...
│   ├── utils/            # Utility functions
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── public/
│   ├── media/            # Static media files
│   ├── manifest.json     # PWA manifest
│   ├── service-worker.js # Service worker
│   └── offline.html      # Offline fallback
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

### 5.2 State Management (Zustand)

**Auth Store:**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) => set({
        token,
        user,
        isAuthenticated: true
      }),

      logout: () => set({
        token: null,
        user: null,
        isAuthenticated: false
      }),
    }),
    {
      name: 'djdip-auth',
      storage: localStorage,
    }
  )
);
```

**Cart Store:**
```typescript
interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (eventId: string) => void;
  updateQuantity: (eventId: string, quantity: number) => void;
  clear: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),

  removeItem: (eventId) => set((state) => ({
    items: state.items.filter(i => i.eventId !== eventId)
  })),

  updateQuantity: (eventId, quantity) => set((state) => ({
    items: state.items.map(i =>
      i.eventId === eventId ? { ...i, quantity } : i
    )
  })),

  clear: () => set({ items: [] }),

  total: () => get().items.reduce(
    (sum, item) => sum + (item.price * item.quantity),
    0
  ),
}));
```

### 5.3 GraphQL Client Setup

**Apollo Client Configuration:**
```typescript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'http://localhost:5000/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('djdip_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

**Example GraphQL Query:**
```typescript
export const GET_EVENTS = gql`
  query GetEvents {
    events {
      id
      title
      description
      date
      price
      imageUrl
      venue {
        id
        name
        city
      }
      genres {
        id
        name
      }
    }
  }
`;

// Usage in component
const { loading, error, data } = useQuery(GET_EVENTS);
```

**Example GraphQL Mutation:**
```typescript
export const CREATE_TICKET = gql`
  mutation CreateTicket($input: CreateTicketDtoInput!) {
    createTicket(input: $input) {
      id
      ticketNumber
      qrCode
      price
    }
  }
`;

// Usage in component
const [createTicket, { loading }] = useMutation(CREATE_TICKET);

const handlePurchase = async () => {
  const { data } = await createTicket({
    variables: {
      input: {
        eventId: selectedEvent.id,
        userId: currentUser.id,
        quantity: 1
      }
    }
  });
};
```

### 5.4 Routing Configuration

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/djs" element={<DJsPage />} />
        <Route path="/djs/:id" element={<DJProfilePage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
        </Route>

        {/* Admin routes */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/events" element={<AdminEvents />} />
          <Route path="/admin/djs" element={<AdminDJs />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 5.5 Component Example

```typescript
// EventCard.tsx
interface EventCardProps {
  event: Event;
  onPurchase?: (eventId: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onPurchase }) => {
  const { addItem } = useCartStore();

  const handleAddToCart = () => {
    addItem({
      eventId: event.id,
      title: event.title,
      price: event.price,
      quantity: 1,
      imageUrl: event.imageUrl
    });

    if (onPurchase) {
      onPurchase(event.id);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <img
        src={event.imageUrl || '/default-event.jpg'}
        alt={event.title}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <h3 className="text-xl font-bold mb-2">{event.title}</h3>
        <p className="text-gray-600 mb-2">{event.venue.name}</p>
        <p className="text-gray-500 text-sm mb-4">
          {new Date(event.date).toLocaleDateString()}
        </p>
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold text-red-600">
            ${event.price}
          </span>
          <button
            onClick={handleAddToCart}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 5.6 Form Handling (React Hook Form + Zod)

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginForm = () => {
  const [login] = useMutation(LOGIN_MUTATION);
  const { login: setAuth } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormData) => {
    const result = await login({ variables: { input: data } });
    setAuth(result.data.login.token, result.data.login.user);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} placeholder="Email" />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register('password')} type="password" placeholder="Password" />
      {errors.password && <span>{errors.password.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
```

---

## 6. GraphQL API Layer

### 6.1 GraphQL Overview

The API uses **HotChocolate 13.9.7** for GraphQL server implementation with:
- Automatic schema generation from C# types
- Built-in authorization directives
- Entity Framework Core integration
- PascalCase to camelCase conversion

**Endpoint**: `http://localhost:5000/graphql`

**Playground**: Built-in GraphQL Playground at `/graphql`

### 6.2 Query Structure (50+ Queries)

**Categories:**

1. **Landing** (1)
   - `landing` - Combined query for homepage data

2. **Events** (5)
   - `events` - All events
   - `event(id)` - Single event
   - `upcomingEvents` - Future events only
   - `eventsByDate(date)` - Filter by date
   - `eventsByGenre(genreId)` - Filter by genre

3. **DJs** (5)
   - `dJs` - All DJ profiles
   - `dJ(id)` - Single DJ
   - `dJsByGenre(genreId)` - Filter by genre
   - `featuredDJs` - Featured DJs
   - `dJTop10(djId)` - DJ's top 10 tracks

4. **Genres** (2)
   - `genres` - All genres
   - `genre(id)` - Single genre

5. **Venues** (2)
   - `venues` - All venues
   - `venue(id)` - Single venue

6. **Tickets** (4)
   - `ticket(id)` - Single ticket
   - `userTickets(userId)` - User's tickets [Auth]
   - `eventTickets(eventId)` - Event tickets [Admin]
   - `validateTicket(qrCode)` - Validate QR code

7. **Orders** (3)
   - `orders` - All orders [Admin]
   - `order(id)` - Single order [Auth]
   - `userOrders(userId)` - User's orders [Auth]

8. **Media** (5)
   - `getEventGallery(eventId)` - Event photos/videos
   - `getUserMedia(userId)` - User uploads
   - `getFeaturedMedia(limit)` - Featured items
   - `getPublicGallery(skip, take)` - Public gallery (paginated)
   - `getMediaById(mediaId)` - Single media item

9. **Services** (7)
   - `services` - All services
   - `featuredServices` - Featured services
   - `servicesByCategory(category)` - Filter by category
   - `service(id)` - Single service
   - `serviceBySlug(slug)` - By URL slug
   - `searchServices(searchTerm)` - Search
   - `myServiceBookings` - User bookings [Auth]

10. **Site Settings** (1)
    - `siteSettings` - Site configuration [Public]

...(and 15+ more query types)

**Example Query:**

```graphql
query GetEventDetails($id: UUID!) {
  event(id: $id) {
    id
    title
    description
    date
    price
    imageUrl
    videoUrl
    venue {
      id
      name
      address
      city
      capacity
    }
    genres {
      id
      name
    }
    eventDJs {
      dj {
        id
        stageName
        bio
        profilePictureUrl
        socialMedia {
          instagram
          soundCloud
          spotify
        }
      }
      setOrder
      setDuration
    }
    reviews {
      id
      rating
      comment
      createdAt
      user {
        fullName
      }
    }
  }
}
```

### 6.3 Mutation Structure (70+ Mutations)

**Categories:**

1. **Authentication** (5)
   ```graphql
   mutation Register($input: RegisterDtoInput!) {
     register(input: $input) {
       token
       refreshToken
       user { id email fullName role }
     }
   }

   mutation Login($input: LoginDtoInput!) {
     login(input: $input) {
       token
       refreshToken
       user { id email fullName role }
     }
   }

   mutation RefreshToken($input: RefreshTokenDtoInput!) {
     refreshToken(input: $input) {
       token
       refreshToken
     }
   }
   ```

2. **Events** (3) [Admin]
   ```graphql
   mutation CreateEvent($input: CreateEventDtoInput!) {
     createEvent(input: $input) {
       id
       title
       date
       price
     }
   }

   mutation UpdateEvent($id: UUID!, $input: UpdateEventDtoInput!) {
     updateEvent(id: $id, input: $input) {
       id
       title
       # ... other fields
     }
   }

   mutation DeleteEvent($id: UUID!) {
     deleteEvent(id: $id)
   }
   ```

3. **DJs** (3) [DJ/Admin]
   ```graphql
   mutation UpdateDJ($id: UUID!, $input: UpdateDJProfileDtoInput!) {
     updateDJ(id: $id, input: $input) {
       id
       stageName
       bio
       profilePictureUrl
       socialMedia {
         instagram
         facebook
         twitter
         tikTok
         youTube
         soundCloud
         spotify
         appleMusic
         beatport
         mixCloud
         website
         discord
         twitch
       }
     }
   }
   ```

4. **Tickets** (3)
   ```graphql
   mutation CreateTicket($input: CreateTicketDtoInput!) {
     createTicket(input: $input) {
       id
       ticketNumber
       qrCode
       price
       purchaseDate
     }
   }

   mutation ScanTicket($qrCode: String!) {
     scanTicket(qrCode: $qrCode) {
       isValid
       isUsed
       event { title date }
       user { fullName email }
     }
   }
   ```

5. **Orders** (2)
   ```graphql
   mutation CreateOrder($input: CreateOrderDtoInput!) {
     createOrder(input: $input) {
       id
       orderDate
       totalAmount
       status
       orderItems {
         event { title }
         quantity
         unitPrice
       }
     }
   }
   ```

...(and 60+ more mutations across other categories)

### 6.4 Authorization

**Authorization Attributes:**

```csharp
// Custom authorization attributes in GraphQL layer
[AuthorizeAuthenticated]  // Requires logged-in user
public async Task<Ticket> CreateTicket(...)

[AuthorizeAdmin]  // Requires Admin role
public async Task<Event> CreateEvent(...)

[AuthorizeDJOrAdmin]  // Requires DJ or Admin role
public async Task<DJProfile> UpdateDJ(...)
```

**Implementation:**

```csharp
public class AuthorizeAuthenticatedAttribute : Attribute
{
    public void Authorize(ClaimsPrincipal principal)
    {
        if (!principal.Identity?.IsAuthenticated ?? true)
        {
            throw new UnauthorizedAccessException("User is not authenticated");
        }
    }
}

public class AuthorizeAdminAttribute : Attribute
{
    public void Authorize(ClaimsPrincipal principal)
    {
        var roleClaim = principal.FindFirst(ClaimTypes.Role);
        if (roleClaim?.Value != "2") // 2 = Admin
        {
            throw new UnauthorizedAccessException("Admin access required");
        }
    }
}
```

### 6.5 GraphQL Schema Example

**Auto-generated from C# types:**

```graphql
type Query {
  events: [Event!]!
  event(id: UUID!): Event
  dJs: [DJProfile!]!
  dJ(id: UUID!): DJProfile
  # ... 40+ more queries
}

type Mutation {
  register(input: RegisterDtoInput!): AuthResponseDto!
  login(input: LoginDtoInput!): AuthResponseDto!
  createEvent(input: CreateEventDtoInput!): Event!
  updateDJ(id: UUID!, input: UpdateDJProfileDtoInput!): DJProfile
  # ... 65+ more mutations
}

type Event {
  id: UUID!
  title: String!
  description: String!
  date: DateTime!
  price: Decimal!
  imageUrl: String
  venue: Venue!
  genres: [Genre!]!
  eventDJs: [EventDJ!]!
  reviews: [Review!]!
}

type DJProfile {
  id: UUID!
  stageName: String!
  bio: String!
  profilePictureUrl: String
  genres: [Genre!]!
  socialMedia: SocialMediaLinks
  # ... more fields
}

input RegisterDtoInput {
  email: String!
  password: String!
  fullName: String!
}
```

---

## 7. Database Schema

### 7.1 Database Overview

**Provider**: SQLite (development), SQL Server (production)
**ORM**: Entity Framework Core 9.0.10
**Tables**: 33
**Migrations**: Located in `Infrastructure/Persistance/Migrations/`

### 7.2 Entity Relationships

**Core Relationships:**

```
User (1) ──── (M) Orders
User (1) ──── (M) Tickets
User (1) ──── (M) Reviews
User (1) ──── (1) Subscription

Event (1) ──── (M) Tickets
Event (1) ──── (1) Venue
Event (M) ──── (M) Genres
Event (M) ──── (M) DJProfiles (through EventDJ)
Event (1) ──── (M) Reviews

Order (1) ──── (M) OrderItems
Order (1) ──── (1) Payment

DJProfile (M) ──── (M) Genres
DJProfile (1) ──── (M) DJTop10

MediaItem (M) ──── (1) User
MediaItem (1) ──── (M) MediaLikes
MediaItem (1) ──── (M) MediaComments
```

### 7.3 Key Tables

**Users (ApplicationUsers)**
```sql
CREATE TABLE ApplicationUsers (
    Id TEXT PRIMARY KEY,
    Email TEXT NOT NULL UNIQUE,
    FullName TEXT NOT NULL,
    PasswordHash TEXT NOT NULL,
    Role INTEGER NOT NULL DEFAULT 0,
    IsEmailVerified INTEGER NOT NULL DEFAULT 0,
    RefreshToken TEXT,
    RefreshTokenExpires DATETIME,
    CurrentSubscriptionId TEXT,
    CreatedAt DATETIME NOT NULL,
    UpdatedAt DATETIME NOT NULL,
    FOREIGN KEY (CurrentSubscriptionId) REFERENCES Subscriptions(Id)
);
```

**Events**
```sql
CREATE TABLE Events (
    Id TEXT PRIMARY KEY,
    Title TEXT NOT NULL,
    Description TEXT NOT NULL,
    Date DATETIME NOT NULL,
    Price REAL NOT NULL,
    ImageUrl TEXT,
    VideoUrl TEXT,
    VenueId TEXT NOT NULL,
    DJProfileId TEXT,
    FOREIGN KEY (VenueId) REFERENCES Venues(Id),
    FOREIGN KEY (DJProfileId) REFERENCES DJProfiles(Id)
);
```

**Tickets**
```sql
CREATE TABLE Tickets (
    Id TEXT PRIMARY KEY,
    TicketNumber TEXT NOT NULL UNIQUE,
    QRCode TEXT NOT NULL UNIQUE,
    EventId TEXT NOT NULL,
    UserId TEXT NOT NULL,
    Price REAL NOT NULL,
    PurchaseDate DATETIME NOT NULL,
    IsValid INTEGER NOT NULL DEFAULT 1,
    IsUsed INTEGER NOT NULL DEFAULT 0,
    UsedDate DATETIME,
    CheckInTime DATETIME,
    WalletPassSerial TEXT,
    WalletPassCreatedAt DATETIME,
    GooglePayPassId TEXT,
    FOREIGN KEY (EventId) REFERENCES Events(Id),
    FOREIGN KEY (UserId) REFERENCES ApplicationUsers(Id)
);

CREATE INDEX IX_Tickets_QRCode ON Tickets(QRCode);
CREATE INDEX IX_Tickets_UserId ON Tickets(UserId);
CREATE INDEX IX_Tickets_EventId ON Tickets(EventId);
```

**DJProfiles**
```sql
CREATE TABLE DJProfiles (
    Id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Bio TEXT NOT NULL,
    LongBio TEXT NOT NULL DEFAULT '',
    Tagline TEXT NOT NULL DEFAULT '',
    Specialties TEXT NOT NULL DEFAULT '',
    YearsExperience INTEGER NOT NULL DEFAULT 0,
    InfluencedBy TEXT NOT NULL DEFAULT '',
    EquipmentUsed TEXT NOT NULL DEFAULT '',
    Achievements TEXT NOT NULL DEFAULT '',
    SocialLinks TEXT,
    ProfilePictureUrl TEXT
);
```

**EventDJ (Many-to-Many Join Table)**
```sql
CREATE TABLE EventDJ (
    EventId TEXT NOT NULL,
    DJId TEXT NOT NULL,
    SetOrder INTEGER NOT NULL,
    SetDuration INTEGER,
    PRIMARY KEY (EventId, DJId),
    FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
    FOREIGN KEY (DJId) REFERENCES DJProfiles(Id) ON DELETE CASCADE
);
```

### 7.4 Database Migrations

**Creating a Migration:**
```bash
dotnet ef migrations add MigrationName \
  --project Infrastructure/Infrastructure.csproj \
  --startup-project DJDiP.csproj
```

**Applying Migrations:**
```bash
dotnet ef database update \
  --project Infrastructure/Infrastructure.csproj \
  --startup-project DJDiP.csproj
```

**Recent Migration Example:**
```csharp
public partial class AddProfilePictureUrlToDJProfile : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "ProfilePictureUrl",
            table: "DJProfiles",
            type: "TEXT",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "ProfilePictureUrl",
            table: "DJProfiles");
    }
}
```

### 7.5 Database Seeding

**Initial data** can be seeded in `DbInitializer.cs`:

```csharp
public static class DbInitializer
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // Seed Genres
        if (!await context.Genres.AnyAsync())
        {
            context.Genres.AddRange(
                new Genre { Id = Guid.NewGuid(), Name = "House", Description = "..." },
                new Genre { Id = Guid.NewGuid(), Name = "Techno", Description = "..." },
                new Genre { Id = Guid.NewGuid(), Name = "Trance", Description = "..." }
            );
        }

        // Seed Admin User
        if (!await context.ApplicationUsers.AnyAsync())
        {
            var admin = new User
            {
                Id = Guid.NewGuid(),
                Email = "admin@djdip.com",
                FullName = "Admin User",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                Role = 2, // Admin
                IsEmailVerified = true,
                CreatedAt = DateTime.UtcNow
            };
            context.ApplicationUsers.Add(admin);
        }

        await context.SaveChangesAsync();
    }
}
```

---

## 8. Authentication & Authorization

### 8.1 JWT Authentication Flow

**1. User Registration:**
```
Client → POST /graphql
        mutation Register { email, password, fullName }
        ↓
Server → Validate input
        → Hash password (BCrypt)
        → Create User entity
        → Save to database
        → Generate JWT tokens
        → Return { token, refreshToken, user }
```

**2. User Login:**
```
Client → POST /graphql
        mutation Login { email, password }
        ↓
Server → Find user by email
        → Verify password (BCrypt.Verify)
        → Generate access token (15 min)
        → Generate refresh token (7 days)
        → Update RefreshToken in database
        → Return { token, refreshToken, user }
```

**3. Authenticated Request:**
```
Client → POST /graphql
        Headers: { Authorization: "Bearer <token>" }
        ↓
Server → Extract token from header
        → Validate token signature
        → Verify expiration
        → Extract claims (userId, role, email)
        → Set ClaimsPrincipal in HttpContext
        → Execute query/mutation
```

**4. Token Refresh:**
```
Client → POST /graphql
        mutation RefreshToken { refreshToken }
        ↓
Server → Validate refresh token
        → Check expiration
        → Find user by token
        → Generate new access token
        → Optionally rotate refresh token
        → Return { token, refreshToken }
```

### 8.2 JWT Token Generation

**JwtTokenService.cs:**
```csharp
public class JwtTokenService
{
    private readonly JwtSettings _jwtSettings;

    public string GenerateAccessToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("EmailVerified", user.IsEmailVerified.ToString())
        };

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_jwtSettings.Secret));

        var credentials = new SigningCredentials(
            key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(
                _jwtSettings.AccessTokenExpirationMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }
}
```

### 8.3 Authorization Policies

**Program.cs Configuration:**
```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireClaim(ClaimTypes.Role, "2"));

    options.AddPolicy("DJOrAdmin", policy =>
        policy.RequireAssertion(context =>
            context.User.HasClaim(ClaimTypes.Role, "1") || // DJ
            context.User.HasClaim(ClaimTypes.Role, "2"))); // Admin

    options.AddPolicy("Authenticated", policy =>
        policy.RequireAuthenticatedUser());

    options.AddPolicy("EmailVerified", policy =>
        policy.RequireClaim("EmailVerified", "True"));
});
```

### 8.4 Frontend Authentication

**Auth Hook:**
```typescript
export const useAuth = () => {
  const { token, user, login, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (email: string, password: string) => {
    try {
      const { data } = await client.mutate({
        mutation: LOGIN_MUTATION,
        variables: { input: { email, password } }
      });

      login(data.login.token, data.login.user);
      localStorage.setItem('djdip_token', data.login.token);
      localStorage.setItem('djdip_refresh', data.login.refreshToken);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('djdip_token');
    localStorage.removeItem('djdip_refresh');
    navigate('/login');
  };

  return { user, token, handleLogin, handleLogout };
};
```

**Protected Route:**
```typescript
export const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
```

### 8.5 Role-Based Access

**User Roles:**
```csharp
public enum UserRole
{
    Customer = 0,  // Regular user
    DJ = 1,        // DJ profile owner
    Admin = 2      // Full system access
}
```

**Access Matrix:**

| Feature | Customer | DJ | Admin |
|---------|----------|----|----|
| Browse events | ✅ | ✅ | ✅ |
| Purchase tickets | ✅ | ✅ | ✅ |
| Upload media | ✅ | ✅ | ✅ |
| Edit own DJ profile | ❌ | ✅ | ✅ |
| Create events | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| Site settings | ❌ | ❌ | ✅ |
| Scan tickets | ❌ | ❌ | ✅ |

---

## 9. External Services & Integrations

### 9.1 Services Overview

| Service | Status | Purpose |
|---------|--------|---------|
| **Web Push** | ✅ Implemented | PWA push notifications |
| **Apple Wallet** | 🟡 Backend Ready | Mobile ticket wallet |
| **Google Pay** | 🟡 Backend Ready | Mobile ticket wallet |
| **Media Storage** | ✅ Local Disk | File upload/storage |
| **Payment Gateway** | ❌ Planned | Stripe/Vipps integration |
| **Email Service** | ❌ Planned | SendGrid/Mailgun |
| **Cloud Storage** | ❌ Planned | Azure Blob/AWS S3 |
| **SMS Notifications** | ❌ Planned | Twilio |

### 9.2 Web Push Notifications

**Configuration (appsettings.json):**
```json
{
  "PushNotification": {
    "Subject": "mailto:admin@djdip.com",
    "PublicKey": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFg...",
    "PrivateKey": "UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls"
  }
}
```

**Backend Service:**
```csharp
public class PushNotificationService
{
    private readonly string _publicKey;
    private readonly string _privateKey;

    public async Task SendNotificationAsync(
        PushSubscription subscription,
        string message)
    {
        var vapidDetails = new VapidDetails(
            "mailto:admin@djdip.com",
            _publicKey,
            _privateKey
        );

        var webPushClient = new WebPushClient();

        var payload = JsonSerializer.Serialize(new {
            title = "DJ-DiP Notification",
            body = message,
            icon = "/icon-192x192.png"
        });

        await webPushClient.SendNotificationAsync(
            subscription,
            payload,
            vapidDetails
        );
    }
}
```

**Frontend Service Worker:**
```javascript
// service-worker.js
self.addEventListener('push', event => {
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon,
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
```

### 9.3 Mobile Wallet Integration

**Apple Wallet Pass Generation:**
```csharp
public class WalletPassService
{
    public async Task<string> GenerateAppleWalletPassAsync(Guid ticketId)
    {
        var ticket = await _unitOfWork.Tickets.GetByIdAsync(ticketId);
        var event = await _unitOfWork.Events.GetByIdAsync(ticket.EventId);

        var passData = new
        {
            passTypeIdentifier = "pass.com.djdip.event",
            teamIdentifier = "YOUR_TEAM_ID",
            serialNumber = ticket.TicketNumber,
            description = event.Title,
            organizationName = "DJ-DiP",
            eventTicket = new
            {
                headerFields = new[] {
                    new { key = "date", label = "DATE", value = event.Date }
                },
                primaryFields = new[] {
                    new { key = "event", label = "EVENT", value = event.Title }
                },
                secondaryFields = new[] {
                    new { key = "venue", label = "VENUE", value = event.Venue.Name }
                },
                auxiliaryFields = new[] {
                    new { key = "price", label = "PRICE", value = $"${ticket.Price}" }
                },
                backFields = new[] {
                    new { key = "terms", label = "TERMS", value = "..." }
                }
            },
            barcode = new
            {
                message = ticket.QRCode,
                format = "PKBarcodeFormatQR",
                messageEncoding = "iso-8859-1"
            }
        };

        // Generate .pkpass file (requires certificates)
        var passUrl = await CreatePassFileAsync(passData);

        // Update ticket record
        ticket.WalletPassSerial = ticket.TicketNumber;
        ticket.WalletPassCreatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        return passUrl;
    }
}
```

**Google Pay Pass Generation:**
```csharp
public async Task<string> GenerateGooglePayPassAsync(Guid ticketId)
{
    var ticket = await _unitOfWork.Tickets.GetByIdAsync(ticketId);
    var event = await _unitOfWork.Events.GetByIdAsync(ticket.EventId);

    var passObject = new
    {
        id = $"{_issuerId}.{ticket.TicketNumber}",
        classId = $"{_issuerId}.event_class",
        state = "ACTIVE",
        barcode = new
        {
            type = "QR_CODE",
            value = ticket.QRCode
        },
        ticketHolderName = ticket.User.FullName,
        eventName = new { defaultValue = new { language = "en", value = event.Title } },
        venue = new { defaultValue = new { language = "en", value = event.Venue.Name } },
        dateTime = new { start = event.Date.ToString("o") }
    };

    // Create JWT and generate save URL
    var jwt = CreateGooglePayJwt(passObject);
    var saveUrl = $"https://pay.google.com/gp/v/save/{jwt}";

    return saveUrl;
}
```

### 9.4 Media File Storage

**Current Implementation (Local Disk):**

```csharp
public class MediaFileService
{
    private readonly string _mediaBasePath;

    public MediaFileService()
    {
        _mediaBasePath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "Frontend", "public", "media", "sections"
        );
    }

    public async Task<MediaUploadResultDto> UploadFileAsync(
        MediaUploadDto upload)
    {
        // Validate file type
        var extension = Path.GetExtension(upload.FileName).ToLower();
        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif",
                                       ".mp4", ".webm", ".mov" };

        if (!allowedExtensions.Contains(extension))
        {
            return new MediaUploadResultDto
            {
                Success = false,
                Message = "Invalid file type"
            };
        }

        // Sanitize filename
        var safeFileName = SanitizeFileName(upload.FileName);

        // Create section directory if not exists
        var sectionPath = Path.Combine(_mediaBasePath, upload.Section);
        Directory.CreateDirectory(sectionPath);

        // Save file
        var filePath = Path.Combine(sectionPath, safeFileName);
        var fileBytes = Convert.FromBase64String(upload.Base64Data);
        await File.WriteAllBytesAsync(filePath, fileBytes);

        // Generate URL
        var url = $"/media/sections/{upload.Section}/{safeFileName}";

        return new MediaUploadResultDto
        {
            Success = true,
            Url = url,
            FileName = safeFileName
        };
    }
}
```

**Planned Migration to Cloud Storage:**

```csharp
// Azure Blob Storage implementation (planned)
public class AzureBlobStorageService : IMediaFileService
{
    private readonly BlobServiceClient _blobServiceClient;

    public async Task<MediaUploadResultDto> UploadFileAsync(
        MediaUploadDto upload)
    {
        var containerName = upload.Section;
        var containerClient = _blobServiceClient
            .GetBlobContainerClient(containerName);

        await containerClient.CreateIfNotExistsAsync(
            PublicAccessType.Blob);

        var blobName = $"{Guid.NewGuid()}-{upload.FileName}";
        var blobClient = containerClient.GetBlobClient(blobName);

        var fileBytes = Convert.FromBase64String(upload.Base64Data);
        using var stream = new MemoryStream(fileBytes);

        await blobClient.UploadAsync(stream, overwrite: true);

        return new MediaUploadResultDto
        {
            Success = true,
            Url = blobClient.Uri.ToString(),
            FileName = blobName
        };
    }
}
```

### 9.5 Payment Integration (Planned)

**Stripe Integration:**

```csharp
// NuGet: Stripe.net
public class StripePaymentService : IPaymentService
{
    private readonly string _apiKey;

    public async Task<PaymentDto> ProcessPaymentAsync(
        CreatePaymentDto dto)
    {
        StripeConfiguration.ApiKey = _apiKey;

        var options = new PaymentIntentCreateOptions
        {
            Amount = (long)(dto.Amount * 100), // Convert to cents
            Currency = "usd",
            PaymentMethodTypes = new List<string> { "card" },
            Metadata = new Dictionary<string, string>
            {
                { "orderId", dto.OrderId.ToString() },
                { "userId", dto.UserId.ToString() }
            }
        };

        var service = new PaymentIntentService();
        var paymentIntent = await service.CreateAsync(options);

        // Save payment record
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = dto.OrderId,
            Amount = dto.Amount,
            Currency = "USD",
            PaymentMethod = "Card",
            TransactionId = paymentIntent.Id,
            Status = PaymentStatus.Pending,
            PaymentDate = DateTime.UtcNow
        };

        await _unitOfWork.Payments.AddAsync(payment);
        await _unitOfWork.SaveChangesAsync();

        return MapToDto(payment);
    }
}
```

---

## 10. Deployment & Infrastructure

### 10.1 Development Environment

**Prerequisites:**
- .NET SDK 8.0+
- Node.js 18+
- SQLite (included)
- Git

**Setup Instructions:**

```bash
# 1. Clone repository
git clone <repository-url>
cd DJ-DiP

# 2. Restore backend dependencies
dotnet restore

# 3. Apply database migrations
dotnet ef database update \
  --project Infrastructure/Infrastructure.csproj \
  --startup-project DJDiP.csproj

# 4. Install frontend dependencies
cd Frontend
npm install

# 5. Start backend (Terminal 1)
cd ..
dotnet run --project DJDiP.csproj
# Backend runs on http://localhost:5000

# 6. Start frontend (Terminal 2)
cd Frontend
npm run dev
# Frontend runs on http://localhost:3000
```

### 10.2 Production Deployment

**Backend Deployment (ASP.NET Core):**

```bash
# 1. Build for production
dotnet publish DJDiP.csproj \
  --configuration Release \
  --output ./publish

# 2. Update connection string in appsettings.Production.json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=<server>;Database=DJDIPDb;..."
  }
}

# 3. Run published app
cd publish
dotnet DJDiP.dll --environment Production
```

**Frontend Deployment:**

```bash
# 1. Build for production
cd Frontend
npm run build
# Output: Frontend/dist/

# 2. Serve static files (options):
# - Nginx
# - Azure Static Web Apps
# - Vercel
# - Netlify
```

### 10.3 Docker Deployment

**Dockerfile (Backend):**
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 5000
ENTRYPOINT ["dotnet", "DJDiP.dll"]
```

**Dockerfile (Frontend):**
```dockerfile
FROM node:18 AS build
WORKDIR /app
COPY Frontend/package*.json ./
RUN npm install
COPY Frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "5000:5000"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__DefaultConnection=Server=db;...
    depends_on:
      - db

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=YourStrong!Passw0rd
    ports:
      - "1433:1433"
    volumes:
      - sqldata:/var/opt/mssql

volumes:
  sqldata:
```

### 10.4 Cloud Deployment Options

**Azure:**

1. **App Service (Backend)**
   ```bash
   az webapp create \
     --resource-group djdip-rg \
     --plan djdip-plan \
     --name djdip-api \
     --runtime "DOTNET|8.0"

   az webapp deployment source config \
     --name djdip-api \
     --resource-group djdip-rg \
     --repo-url <git-url> \
     --branch main
   ```

2. **Static Web Apps (Frontend)**
   ```bash
   az staticwebapp create \
     --name djdip-frontend \
     --resource-group djdip-rg \
     --source <git-url> \
     --branch main \
     --app-location "/Frontend" \
     --output-location "dist"
   ```

3. **Azure SQL Database**
   ```bash
   az sql server create \
     --name djdip-sqlserver \
     --resource-group djdip-rg \
     --location westus \
     --admin-user djdipadmin \
     --admin-password <password>

   az sql db create \
     --resource-group djdip-rg \
     --server djdip-sqlserver \
     --name DJDIPDb \
     --service-objective S0
   ```

**AWS:**

1. **Elastic Beanstalk (Backend)**
2. **S3 + CloudFront (Frontend)**
3. **RDS SQL Server (Database)**

**Vercel/Netlify (Frontend Only):**
- Fastest deployment for React apps
- Automatic CI/CD from Git
- Global CDN

### 10.5 Environment Variables

**Backend (.env or appsettings.json):**
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "<connection-string>"
  },
  "JwtSettings": {
    "Secret": "<jwt-secret>",
    "Issuer": "DJDiP-API",
    "Audience": "DJDiP-Client"
  },
  "FrontendUrl": "https://djdip.com",
  "BaseUrl": "https://api.djdip.com",
  "AppleWallet": {
    "PassTypeIdentifier": "pass.com.djdip.event",
    "TeamIdentifier": "<team-id>"
  },
  "GooglePay": {
    "IssuerId": "<issuer-id>",
    "ServiceAccountEmail": "<email>"
  }
}
```

**Frontend (.env):**
```
VITE_API_URL=https://api.djdip.com/graphql
VITE_PUSHER_KEY=<pusher-key>
VITE_STRIPE_PUBLIC_KEY=<stripe-key>
```

---

## 11. Development Workflow

### 11.1 Git Workflow

**Branch Strategy:**
```
main (production)
├── develop (staging)
│   ├── feature/event-management
│   ├── feature/dj-profiles
│   └── feature/payment-integration
└── hotfix/ticket-validation-bug
```

**Commit Conventions:**
```
feat: Add ticket QR code scanning
fix: Resolve DJ profile image upload issue
docs: Update API documentation
style: Format code with Prettier
refactor: Simplify authentication service
test: Add unit tests for OrderService
chore: Update dependencies
```

### 11.2 Code Review Checklist

**Backend:**
- [ ] Follows Clean Architecture principles
- [ ] Proper error handling
- [ ] Input validation
- [ ] Authorization checks
- [ ] Unit tests included
- [ ] Database migrations applied
- [ ] Documentation updated

**Frontend:**
- [ ] TypeScript types defined
- [ ] Responsive design
- [ ] Accessibility (ARIA labels)
- [ ] Error states handled
- [ ] Loading states implemented
- [ ] GraphQL queries optimized
- [ ] No console errors

### 11.3 Testing Workflow

**Backend Tests (xUnit):**
```csharp
public class EventServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly EventService _service;

    [Fact]
    public async Task CreateEvent_ValidInput_ReturnsEvent()
    {
        // Arrange
        var dto = new CreateEventDto { Title = "Test Event", ... };

        // Act
        var result = await _service.CreateAsync(dto);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Test Event", result.Title);
    }
}
```

**Frontend Tests (Vitest + React Testing Library):**
```typescript
describe('EventCard', () => {
  it('renders event details correctly', () => {
    const event = {
      id: '1',
      title: 'Test Event',
      price: 25.00,
      date: '2025-12-31'
    };

    render(<EventCard event={event} />);

    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
  });

  it('calls onPurchase when Add to Cart clicked', () => {
    const onPurchase = vi.fn();
    render(<EventCard event={mockEvent} onPurchase={onPurchase} />);

    fireEvent.click(screen.getByText('Add to Cart'));

    expect(onPurchase).toHaveBeenCalledWith(mockEvent.id);
  });
});
```

### 11.4 GraphQL Query Testing

**Using GraphQL Playground:**

```graphql
# Test Query
query GetEvents {
  events {
    id
    title
    date
    price
  }
}

# Test Mutation (with auth header)
# Headers: { "Authorization": "Bearer <token>" }
mutation CreateTicket($input: CreateTicketDtoInput!) {
  createTicket(input: $input) {
    id
    ticketNumber
    qrCode
  }
}

# Variables
{
  "input": {
    "eventId": "...",
    "userId": "...",
    "quantity": 1
  }
}
```

**Automated GraphQL Tests:**

```bash
#!/bin/bash
# test-graphql-api.sh

curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ events { id title } }"}'
```

---

## 12. Testing Strategy

### 12.1 Testing Pyramid

```
        /\
       /E2E\      (5%) - End-to-end tests
      /------\
     /  Inte- \   (15%) - Integration tests
    /  gration \
   /------------\
  /   Unit Tests \ (80%) - Unit tests
 /________________\
```

### 12.2 Unit Testing

**Backend (xUnit + Moq):**

```csharp
// Install NuGet packages:
// - xunit
// - xunit.runner.visualstudio
// - Moq
// - FluentAssertions

public class TicketServiceTests
{
    private readonly Mock<IUnitOfWork> _mockUnitOfWork;
    private readonly Mock<ITicketRepository> _mockTicketRepo;
    private readonly TicketService _service;

    public TicketServiceTests()
    {
        _mockUnitOfWork = new Mock<IUnitOfWork>();
        _mockTicketRepo = new Mock<ITicketRepository>();
        _mockUnitOfWork.Setup(u => u.Tickets).Returns(_mockTicketRepo.Object);
        _service = new TicketService(_mockUnitOfWork.Object);
    }

    [Fact]
    public async Task ValidateTicket_ValidQRCode_ReturnsTrue()
    {
        // Arrange
        var qrCode = "VALID_QR_CODE";
        var ticket = new Ticket
        {
            QRCode = qrCode,
            IsValid = true,
            IsUsed = false
        };

        _mockTicketRepo
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Ticket, bool>>>()))
            .ReturnsAsync(new[] { ticket });

        // Act
        var result = await _service.ValidateAsync(qrCode);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task ValidateTicket_UsedTicket_ReturnsFalse()
    {
        // Arrange
        var ticket = new Ticket { IsValid = true, IsUsed = true };
        _mockTicketRepo
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Ticket, bool>>>()))
            .ReturnsAsync(new[] { ticket });

        // Act
        var result = await _service.ValidateAsync("QR_CODE");

        // Assert
        result.Should().BeFalse();
    }
}
```

**Frontend (Vitest + React Testing Library):**

```bash
# Install dependencies
npm install -D vitest @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event
```

```typescript
// LoginForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('validates email format', async () => {
    render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText('Email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockLogin = vi.fn();
    render(<LoginForm onLogin={mockLogin} />);

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });
});
```

### 12.3 Integration Testing

**Backend Integration Tests:**

```csharp
public class EventRepositoryIntegrationTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly EventRepository _repository;

    public EventRepositoryIntegrationTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new AppDbContext(options);
        _repository = new EventRepository(_context);
    }

    [Fact]
    public async Task GetUpcomingEvents_ReturnsOnlyFutureEvents()
    {
        // Arrange
        await _context.Events.AddRangeAsync(
            new Event { Date = DateTime.UtcNow.AddDays(-1), Title = "Past" },
            new Event { Date = DateTime.UtcNow.AddDays(1), Title = "Future1" },
            new Event { Date = DateTime.UtcNow.AddDays(7), Title = "Future2" }
        );
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetUpcomingEventsAsync();

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(e => e.Date >= DateTime.UtcNow.Date);
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
```

### 12.4 E2E Testing (Playwright)

```typescript
// e2e/purchase-ticket.spec.ts
import { test, expect } from '@playwright/test';

test('User can purchase a ticket', async ({ page }) => {
  // 1. Navigate to landing page
  await page.goto('http://localhost:3000');

  // 2. Click on an event
  await page.click('text=View Events');
  await page.click('.event-card:first-child');

  // 3. Add to cart
  await page.click('button:has-text("Add to Cart")');

  // 4. Go to checkout
  await page.click('a[href="/cart"]');
  await page.click('button:has-text("Checkout")');

  // 5. Login (or skip if already logged in)
  if (await page.isVisible('text=Login')) {
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Login")');
  }

  // 6. Complete purchase
  await page.click('button:has-text("Complete Purchase")');

  // 7. Verify success
  await expect(page.locator('text=Purchase successful')).toBeVisible();
  await expect(page.locator('.ticket-qr-code')).toBeVisible();
});
```

---

## 13. Security Considerations

### 13.1 Authentication Security

**Password Hashing:**
```csharp
// BCrypt with work factor 12
var hashedPassword = BCrypt.Net.BCrypt.HashPassword(
    password,
    workFactor: 12
);

var isValid = BCrypt.Net.BCrypt.Verify(password, hashedPassword);
```

**JWT Security:**
- **Secret Key**: Minimum 256 bits (32 characters)
- **Algorithm**: HMACSHA256
- **Token Expiration**: 15 minutes (access), 7 days (refresh)
- **Refresh Token Rotation**: New refresh token on each use
- **Token Blacklisting**: Store revoked tokens (logout)

### 13.2 Input Validation

**Backend:**
```csharp
public class CreateEventDto
{
    [Required(ErrorMessage = "Title is required")]
    [StringLength(200, MinimumLength = 3)]
    public string Title { get; set; }

    [Required]
    [Range(0, 10000, ErrorMessage = "Price must be between 0 and 10000")]
    public decimal Price { get; set; }

    [Required]
    [FutureDate(ErrorMessage = "Event date must be in the future")]
    public DateTime Date { get; set; }
}
```

**Frontend:**
```typescript
const eventSchema = z.object({
  title: z.string().min(3).max(200),
  price: z.number().min(0).max(10000),
  date: z.date().refine(date => date > new Date(), {
    message: "Event date must be in the future"
  })
});
```

### 13.3 SQL Injection Prevention

**Using EF Core (Parameterized Queries):**
```csharp
// SAFE - EF Core uses parameterized queries
var events = await _context.Events
    .Where(e => e.Title.Contains(searchTerm))
    .ToListAsync();

// UNSAFE - Never use string concatenation
// var sql = $"SELECT * FROM Events WHERE Title LIKE '%{searchTerm}%'";
```

### 13.4 XSS Prevention

**Frontend:**
- React automatically escapes HTML content
- Use `dangerouslySetInnerHTML` only when necessary
- Sanitize user-generated content

```typescript
// SAFE
<div>{userComment}</div>

// UNSAFE
<div dangerouslySetInnerHTML={{ __html: userComment }} />

// SAFE with sanitization
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(userComment)
}} />
```

### 13.5 CORS Configuration

```csharp
// Program.cs
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000", "https://djdip.com")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

app.UseCors();
```

### 13.6 Rate Limiting

```csharp
// NuGet: AspNetCoreRateLimit
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(options =>
{
    options.GeneralRules = new List<RateLimitRule>
    {
        new RateLimitRule
        {
            Endpoint = "*",
            Limit = 100,
            Period = "1m"
        },
        new RateLimitRule
        {
            Endpoint = "*/graphql",
            Limit = 50,
            Period = "1m"
        }
    };
});
```

### 13.7 File Upload Security

```csharp
public async Task<MediaUploadResultDto> UploadFileAsync(MediaUploadDto dto)
{
    // 1. Validate file size
    if (dto.Base64Data.Length > 5 * 1024 * 1024) // 5MB
    {
        return new MediaUploadResultDto
        {
            Success = false,
            Message = "File too large"
        };
    }

    // 2. Validate file extension
    var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif" };
    var extension = Path.GetExtension(dto.FileName).ToLower();

    if (!allowedExtensions.Contains(extension))
    {
        return new MediaUploadResultDto
        {
            Success = false,
            Message = "Invalid file type"
        };
    }

    // 3. Sanitize filename
    var safeFileName = Regex.Replace(dto.FileName, @"[^a-zA-Z0-9_\-\.]", "");

    // 4. Generate unique filename
    var uniqueFileName = $"{Guid.NewGuid()}-{safeFileName}";

    // 5. Save file outside web root or with restricted access
    var filePath = Path.Combine(_mediaBasePath, uniqueFileName);
    await File.WriteAllBytesAsync(filePath, fileBytes);
}
```

---

## 14. Performance Optimization

### 14.1 Database Optimization

**1. Indexes:**
```csharp
// AppDbContext.OnModelCreating
modelBuilder.Entity<Event>()
    .HasIndex(e => e.Date);

modelBuilder.Entity<Ticket>()
    .HasIndex(t => t.QRCode)
    .IsUnique();

modelBuilder.Entity<User>()
    .HasIndex(u => u.Email)
    .IsUnique();

// Composite index
modelBuilder.Entity<Order>()
    .HasIndex(o => new { o.UserId, o.OrderDate });
```

**2. Query Optimization:**
```csharp
// AVOID N+1 queries - use Include
var events = await _context.Events
    .Include(e => e.Venue)
    .Include(e => e.Genres)
    .Include(e => e.EventDJs)
        .ThenInclude(edj => edj.DJ)
    .ToListAsync();

// Use AsNoTracking for read-only queries
var events = await _context.Events
    .AsNoTracking()
    .ToListAsync();

// Project only needed fields
var eventSummaries = await _context.Events
    .Select(e => new EventSummaryDto
    {
        Id = e.Id,
        Title = e.Title,
        Date = e.Date,
        Price = e.Price
    })
    .ToListAsync();
```

**3. Pagination:**
```csharp
public async Task<PagedResult<EventDto>> GetEventsAsync(int page, int pageSize)
{
    var query = _context.Events.AsQueryable();

    var totalCount = await query.CountAsync();

    var items = await query
        .OrderBy(e => e.Date)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();

    return new PagedResult<EventDto>
    {
        Items = items.Select(MapToDto),
        TotalCount = totalCount,
        PageSize = pageSize,
        CurrentPage = page
    };
}
```

### 14.2 GraphQL Optimization

**1. DataLoader (Batch Loading):**
```csharp
// HotChocolate automatically batches requests
public class EventResolvers
{
    public async Task<Venue> GetVenueAsync(
        [Parent] Event event,
        [Service] IVenueRepository venueRepo,
        VenueByIdDataLoader dataLoader)
    {
        return await dataLoader.LoadAsync(event.VenueId);
    }
}
```

**2. Field-Level Authorization:**
```csharp
public class Event
{
    public string Title { get; set; }

    [Authorize(Policy = "AdminOnly")]
    public decimal Revenue { get; set; } // Only admins can see revenue
}
```

**3. Query Complexity Limits:**
```csharp
builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>()
    .ModifyRequestOptions(opt =>
    {
        opt.MaxOperationComplexity = 200;
        opt.UseComplexityMultipliers = true;
    });
```

### 14.3 Frontend Optimization

**1. Code Splitting:**
```typescript
// Lazy load pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));

<Route
  path="/admin"
  element={
    <Suspense fallback={<Loading />}>
      <AdminDashboard />
    </Suspense>
  }
/>
```

**2. Image Optimization:**
```typescript
// Use WebP with fallback
<picture>
  <source srcSet={`${event.imageUrl}.webp`} type="image/webp" />
  <img src={event.imageUrl} alt={event.title} loading="lazy" />
</picture>
```

**3. Memoization:**
```typescript
const EventList = ({ events, onSelect }) => {
  const sortedEvents = useMemo(
    () => events.sort((a, b) => new Date(a.date) - new Date(b.date)),
    [events]
  );

  return (
    <div>
      {sortedEvents.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};
```

**4. Apollo Client Caching:**
```typescript
const client = new ApolloClient({
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          events: {
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            }
          }
        }
      }
    }
  })
});
```

### 14.4 Caching Strategy

**Backend:**
```csharp
// NuGet: Microsoft.Extensions.Caching.Memory
public class EventService
{
    private readonly IMemoryCache _cache;

    public async Task<IEnumerable<EventDto>> GetAllAsync()
    {
        var cacheKey = "events_all";

        if (!_cache.TryGetValue(cacheKey, out IEnumerable<EventDto> events))
        {
            events = await _unitOfWork.Events.GetAllAsync();

            _cache.Set(cacheKey, events, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            });
        }

        return events;
    }
}
```

**Frontend:**
```typescript
// React Query for caching
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['events'],
  queryFn: fetchEvents,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

---

## 15. Troubleshooting & FAQ

### 15.1 Common Issues

**Issue: "Failed to load site settings: 400 Bad Request"**

**Cause**: GraphQL query requesting fewer fields than DTO contains

**Solution**: Update GraphQL query to include all DTO fields
```typescript
// Before (only 15 fields)
const GET_SITE_SETTINGS = gql`
  query { siteSettings { siteName primaryColor ... } }
`;

// After (all 74 fields)
const GET_SITE_SETTINGS = gql`
  query { siteSettings {
    siteName primaryColor accentColor ... (all fields)
  } }
`;
```

---

**Issue: "DJ profile update returns 500 error"**

**Cause**: Multiple potential issues:
1. Mutation name mismatch
2. Field mapping issue
3. Non-nullable fields

**Solution**:
```typescript
// 1. Use correct mutation name
const UPDATE_DJ = gql`
  mutation UpdateDJ($id: UUID!, $input: UpdateDJProfileDtoInput!) {
    updateDJ(id: $id, input: $input) { ... }
  }
`;

// 2. Map fields correctly
const input = {
  stageName: formData.name, // Backend expects stageName
  bio: formData.bio,
  // ... other fields
};

// 3. Make nullable fields optional in DTO
public string? ProfilePictureUrl { get; set; }
```

---

**Issue: "Image uploads not persisting to database"**

**Cause**: Entity not tracked or `Update()` called on already-tracked entity

**Solution**:
```csharp
// Remove UpdateAsync call if entity already tracked
public async Task UpdateAsync(Guid id, UpdateDJProfileDto dto)
{
    var dj = await _unitOfWork.DJProfiles.GetByIdAsync(id); // Tracked

    // Modify properties
    dj.Name = dto.StageName;
    dj.ProfilePictureUrl = uploadedImageUrl;

    // Just save - entity already tracked!
    await _unitOfWork.SaveChangesAsync();
}
```

---

**Issue: "CORS error when calling GraphQL API"**

**Cause**: Frontend origin not allowed

**Solution**:
```csharp
// Program.cs
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

app.UseCors(); // Must be before UseAuthentication/Authorization
```

---

**Issue: "Database migration fails"**

**Cause**: Migration namespace or project mismatch

**Solution**:
```bash
# Always specify both projects
dotnet ef migrations add MigrationName \
  --project Infrastructure/Infrastructure.csproj \
  --startup-project DJDiP.csproj

dotnet ef database update \
  --project Infrastructure/Infrastructure.csproj \
  --startup-project DJDiP.csproj
```

---

### 15.2 Frequently Asked Questions

**Q: How do I add a new entity to the system?**

A: Follow these steps:
1. Create domain model in `Domain/Models/EntityName.cs`
2. Add DbSet to `AppDbContext.cs`
3. Configure relationships in `OnModelCreating`
4. Create migration: `dotnet ef migrations add AddEntity`
5. Apply migration: `dotnet ef database update`
6. Create DTOs in `Application/DTO/EntityDTO/`
7. Create repository interface and implementation
8. Create service interface and implementation
9. Add GraphQL queries/mutations
10. Register service in `Program.cs`

---

**Q: How do I change the database from SQLite to SQL Server?**

A: Update `appsettings.json`:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=DJDIPDb;User Id=sa;Password=YourPassword;TrustServerCertificate=True"
  }
}
```

Update `Program.cs`:
```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));
```

---

**Q: How do I add a new role (e.g., "Promoter")?**

A:
1. Update `UserRole` enum
2. Add authorization attribute
3. Update policies in `Program.cs`
4. Add GraphQL authorization checks

---

**Q: How do I implement email verification?**

A: Check the planned implementation in `AuthenticationService.cs`:
1. Generate verification token
2. Send email with link
3. Verify token on callback
4. Update `IsEmailVerified` flag

---

**Q: How do I integrate Stripe for payments?**

A:
1. Install NuGet: `Stripe.net`
2. Implement `IPaymentService` with Stripe
3. Add Stripe webhook endpoint
4. Handle payment events (success, failed, refund)
5. Update order status based on payment status

---

### 15.3 Debug Mode

**Backend:**
```bash
# Run with detailed logging
ASPNETCORE_ENVIRONMENT=Development dotnet run --project DJDiP.csproj

# Check logs in console or appsettings.json:
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.EntityFrameworkCore": "Information"
    }
  }
}
```

**Frontend:**
```bash
# Run dev server with debugging
npm run dev

# Check Apollo Client DevTools in browser
# React DevTools for component debugging
```

**GraphQL Debugging:**
- Use built-in GraphQL Playground at `/graphql`
- Enable query logging in HotChocolate
- Check EF Core SQL logging

---

### 15.4 Support & Resources

**Documentation:**
- README.md
- QUICK-START-GUIDE.md
- AUTHORIZATION-GUIDE.md
- GRAPHQL-API-DOCS.md

**External Docs:**
- ASP.NET Core: https://docs.microsoft.com/aspnet/core
- HotChocolate: https://chillicream.com/docs/hotchocolate
- React: https://react.dev
- Apollo Client: https://www.apollographql.com/docs/react

**Community:**
- GitHub Issues
- Stack Overflow
- Discord/Slack channels

---

## Conclusion

This documentation provides a comprehensive overview of the DJ-DiP (KlubN) platform. For specific implementation details, refer to the codebase comments and inline documentation.

**Key Takeaways:**
- Clean Architecture with clear separation of concerns
- GraphQL API with HotChocolate
- React 19 + TypeScript frontend
- JWT authentication with role-based authorization
- Entity Framework Core with SQLite/SQL Server
- PWA support with push notifications
- Mobile wallet integration (Apple Wallet, Google Pay)
- Comprehensive feature set for event ticketing and DJ management

**Next Steps:**
1. Set up development environment
2. Review code structure
3. Run automated tests
4. Implement pending features (payments, cloud storage)
5. Deploy to staging/production

---

**Document Version**: 1.0.0
**Last Updated**: November 5, 2025
**Maintained By**: Development Team
**License**: Proprietary

**Thank you for using DJ-DiP!** 🎵🎧
