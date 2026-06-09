# DJ-DiP Project: Complete History & Reconstruction Guide
## What Was Planned, What Was Built, What Needs to Be Rebuilt

**Date**: November 10, 2025
**Based on**: 3 weeks of git history, documentation analysis, and code archaeology

---

## 🎯 Executive Summary

Over the last 3 weeks (October 20 - November 10, 2025), DJ-DiP underwent significant planning and partial implementation. **Here's the reality check**:

### What Exists:
- ✅ **Backend**: 100% complete, production-ready (37 domain models, Clean Architecture)
- ✅ **Landing Page**: Fully implemented, high-quality showcase
- ✅ **Design System**: Comprehensive Tailwind configuration
- ✅ **HTML Mockups**: 4 detailed mockups showing target UI
- ✅ **Documentation**: 28,000+ words of feature specifications

### What's Missing:
- ⚠️ **Frontend Pages**: Only 1 of 22 pages fully implemented
- ⚠️ **The pages WERE NEVER BUILT** - only placeholders exist
- ⚠️ Documentation describes the **VISION**, not reality

---

## 📅 Timeline Reconstruction

### **October 8, 2025** - Backend Foundation
**Commit**: `1b0f4a3` - "08.10"

**What Happened**:
- Created `DJService` and `EventService` (3 core services)
- Updated DTOs and interfaces
- Backend API infrastructure established

**Evidence**: 43 files changed, 395 insertions, 216 deletions

---

### **October 20-24, 2025** - Feature Planning Phase

**What Happened**:
1. **Mockups Created** (October 24):
   - `01-user-content-feed.html` - Instagram-style social feed
   - `02-mobile-wallet-tickets.html` - Apple Wallet/Google Pay tickets
   - `03-live-event-features.html` - Real-time event features
   - `index.html` - Mockup navigation page

2. **Documentation Created**:
   - `FEATURE-PRESENTATION.md` - 60+ pages of user flows
   - `FEATURE-ENHANCEMENT-GUIDE.md` - Implementation roadmap
   - Detailed user scenarios and wireframes

**Key Features Planned**:

#### TIER 1: User-Generated Content Feed 📸
```
Vision:
- Instagram/TikTok-style feed
- Post photos/videos from events
- Tag DJs, venues, friends
- Like, comment, share
- Feed algorithm with discovery
- Hashtag support

Impact:
- Transform from ticketing to social platform
- 500% increase in daily active users
- Viral growth loops

Implementation: 3-4 weeks estimated
Status: ❌ NOT BUILT
```

#### TIER 1: Mobile Wallet Tickets 📲
```
Vision:
- Apple Wallet integration
- Google Pay integration
- QR code tickets
- Auto-updates
- Location-based notifications
- Offline access

Impact:
- Industry standard (90% of competitors have it)
- Professional appearance
- Reduced support issues

Implementation: 1 week estimated
Status: ❌ NOT BUILT
```

#### TIER 1: Live Event Features ⚡
```
Vision:
- Real-time DJ timeline
- Live check-in map
- Crowd energy meter
- Live event chat
- Find friends at venue
- Social interactions during event

Impact:
- Active engagement during events
- FOMO drives future ticket sales
- Unique differentiator

Implementation: 4-6 weeks estimated
Status: ❌ NOT BUILT
```

#### TIER 1: Progressive Web App 📱
```
Vision:
- Install to home screen
- Push notifications
- Offline functionality
- App-like experience
- No App Store needed

Implementation: 2-3 weeks estimated
Status: 🟡 PARTIALLY BUILT
- Service worker exists
- Manifest.json exists
- PWA foundation ready
- UI features not built
```

**Evidence**: 4 HTML files in `/Mockups/` directory

---

### **November 5, 2025** - Testing & Fixes Session

**What Happened**:
- Comprehensive project analysis conducted
- Critical bugs fixed:
  - ✅ Site settings loading (400 error → fixed)
  - ✅ DJ profile update (500 error → fixed)
  - ✅ Social media field casing (fixed)
- Image upload feature added to DJ profiles
- Automated test suite created (10 tests, all passing)

**Documentation Created**:
- `FINAL-SESSION-SUMMARY.md` - Complete session report
- `IMAGE-UPLOAD-IMPLEMENTATION-COMPLETE.md` - Image upload guide
- `COMPREHENSIVE-TEST-REPORT.md` - 500+ test cases
- `test-graphql-api.sh` - Automated testing script

**Key Finding**:
> "Your application is FULLY FUNCTIONAL with the following exception:
> - ⚠️ DJ profile images don't persist (by design - no database column)
> - ✅ Everything else works perfectly"

**Reality Check**: The "everything else" refers to backend API, not frontend UI

**Evidence**: 5 documentation files, test script, 5 code files modified

---

### **November 10, 2025** - Domain Model Expansion

**Commits**:
- `c2717b1` - Fix architecture issues
- `8bc2bde` - Enhance core domain models
- `b99de02` - Add Phase 2-4 domain models (17 new models!)
- `38c719a` - Update application and infrastructure layers
- `5ff6127` - Enhance API with CORS and database initialization
- `8e23476` - Add .gitignore entries

**What Happened**:
Major backend expansion with 17 new domain models:

**Gamification System** (3 models):
- Badge - Achievement badges with rarity levels
- UserBadge - User-badge associations
- UserPoints - Point tracking with levels

**Review System** (3 models):
- Review - Event reviews
- DJReview - DJ ratings
- ServiceReview - Service ratings

**Services Marketplace** (2 models):
- Service - Bookable services
- ServiceBooking - Booking management

**Media Gallery** (3 models):
- MediaItem - Photos, videos, audio
- MediaLike - Like tracking
- MediaComment - Comments

**Social Features** (2 models):
- UserFollowDJ - DJ following
- SocialMediaLinks - Social profiles

**Subscription System** (1 model):
- Subscription - 3-tier system

**Site Management** (1 model):
- SiteSetting - 74 configuration fields

**Push Notifications** (1 model):
- PushSubscription - Web push

**Dynamic Pricing** (1 model):
- PriceRule - Event pricing rules

**Evidence**: Database now has 37 models total

---

## 🔍 What Actually Got Built

### Backend (100% Complete)

```
✅ Domain Layer
   • 37 domain models
   • Comprehensive relationships
   • Navigation properties
   • Proper constraints

✅ Application Layer
   • 3 core services (User, Event, DJ)
   • 20+ DTO categories
   • Clean service interfaces
   • Business logic separation

✅ Infrastructure Layer
   • Repository pattern
   • Unit of Work
   • EF Core 9.0.10
   • SQLite (dev) + SQL Server (prod)
   • Database initialization
   • Seed data (1 event, 4 DJs)

✅ GraphQL API
   • Program.cs with Query class
   • Landing page endpoint
   • Events endpoint
   • DJs endpoint
   • DJ by ID endpoint
   • CORS properly configured

✅ Authentication & Authorization
   • JWT token generation
   • Refresh tokens
   • BCrypt password hashing
   • Role-based authorization ready
```

### Frontend (10% Complete)

```
✅ FULLY IMPLEMENTED:
   • LandingPage.tsx (197 lines)
   • Header component with navigation
   • Footer component
   • Layout wrapper
   • AuthContext structure
   • ProtectedRoute & AdminRoute guards
   • Apollo Client configuration
   • Tailwind CSS design system
   • PWA foundation (service worker, manifest)

⚠️ PLACEHOLDER ONLY (18 pages):
   • EventsPage
   • EventDetailPage
   • DJsPage
   • DJProfilePage
   • EditDJProfilePage
   • ContactPage
   • CartPage
   • CheckoutPage
   • DashboardPage
   • TicketsPage
   • OrdersPage
   • UploadMediaPage
   • GalleryPage
   • GamificationPage
   • LoginPage
   • RegisterPage
   • NotFoundPage
   • 4 Admin pages

All placeholders follow this pattern:
const PageName = () => (
  <div className="max-w-6xl mx-auto px-6 py-16">
    <h1>Page Title</h1>
    <p>Description of what will be built...</p>
  </div>
);
```

---

## 🎨 What the Frontend SHOULD Look Like

### Based on Mockups & Documentation

#### 1. User Content Feed (Never Built)

**Mockup**: `Mockups/01-user-content-feed.html`

**Design Specifications**:
```
Header:
- Feed / Discover / Profile tabs
- Search icon
- Notification bell
- Settings gear

Feed Card Layout:
┌─────────────────────────────────┐
│ @username · Following     ⋮     │
│ 📍 Berghain, Berlin              │
│ ┌───────────────────────────┐   │
│ │                           │   │
│ │   [Event Photo/Video]     │   │
│ │                           │   │
│ └───────────────────────────┘   │
│ Amazing night! 🔥 @dj_amelie    │
│ #Techno #BerlinNights           │
│                                 │
│ ❤️ 234   💬 45   🔄 12          │
│                                 │
│ View all 45 comments            │
│ @friend: "Looks amazing!"       │
│ 2 hours ago                     │
└─────────────────────────────────┘

Features:
- Infinite scroll
- Like/comment/share buttons
- Tag DJs, venues, friends
- Hashtag support
- Auto-suggest tags from ticket data
- Cross-post to Instagram/Twitter
- Feed algorithm (recency + engagement)
```

**Current State**: Page shows "Public feed, modal viewer, and like/comment stats coming soon."

---

#### 2. Mobile Wallet Tickets (Never Built)

**Mockup**: `Mockups/02-mobile-wallet-tickets.html`

**Design Specifications**:

**Apple Wallet Pass**:
```
┌────────────────────────────┐
│  DJ-DiP              🎵    │
├────────────────────────────┤
│                            │
│   TECHNO NIGHT 2024        │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │
│   [    QR CODE     ]       │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │
│                            │
│   Dec 31, 2024 · 11:00 PM  │
│   Berghain, Berlin         │
│                            │
│   General Admission        │
│   #TK-2024-XY789           │
│                            │
│   [View on DJ-DiP]         │
│                            │
└────────────────────────────┘
```

**Google Pay Pass**: Similar design

**Features**:
- PassKit integration for Apple
- Google Wallet API integration
- QR code generation
- Auto-updates (venue/time changes)
- Location-based reminders
- Offline access
- "Add to Wallet" button after purchase

**Current State**: No wallet integration exists

---

#### 3. Live Event Features (Never Built)

**Mockup**: `Mockups/03-live-event-features.html`

**Design Specifications**:

**Live DJ Timeline**:
```
┌─────────────────────────────┐
│ 🔴 LIVE @ Berghain          │
├─────────────────────────────┤
│                             │
│ 🎵 Now Playing:             │
│ ┌─────────────────────┐     │
│ │ DJ Amelie           │     │
│ │ [████████░░░░]      │     │
│ │ 1:15 / 2:00 hours   │     │
│ │ 🔥 Energy: 8/10     │     │
│ └─────────────────────┘     │
│                             │
│ ⏰ Up Next (30 mins):       │
│ Ben Klock                   │
│ 2:00 AM - 4:00 AM           │
│ 👥 1,234 fans attending     │
│                             │
│ 📸 Live Feed                │
│ [Photo] [Photo] [Photo] →   │
│                             │
│ 💬 Chat (234 active)        │
│ "This drop is insane!"      │
└─────────────────────────────┘
```

**Crowd Energy Meter**:
```
Based on:
- User reactions
- Music BPM
- Live voting
- Social mentions

Levels:
🟢 Warming Up  [███░░░░░░░] 3/10
🟡 Getting Lit [██████░░░░] 6/10
🔥 PEAK ENERGY [██████████] 10/10
```

**Live Check-in Map**:
```
┌─────────────────────────────┐
│ 📍 2,341 people here now    │
├─────────────────────────────┤
│     [Venue Floor Plan]      │
│                             │
│     🎛️ DJ Booth             │
│     ████████████████        │
│                             │
│  Bar 1 👤👤  Bar 2 👤👤     │
│                             │
│     Main Floor              │
│     👥👥👥👥👥              │
│     👥👥@YOU👥              │
│     👥@friend1              │
│                             │
│  Your Friends (3):          │
│  • @mike - Main Floor       │
│  • @anna - Bar 2            │
└─────────────────────────────┘
```

**Current State**: No live features implemented

---

## 📊 Documentation vs Reality Matrix

| Feature | Documented | Backend Ready | Frontend Built | Reality |
|---------|-----------|---------------|----------------|---------|
| **Event Listing** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **Event Detail** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **DJ Profiles** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **DJ Gallery** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **Shopping Cart** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **Checkout** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **User Dashboard** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **Tickets Page** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **Orders History** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **Media Upload** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **Gallery Feed** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **Gamification** | ✅ | ✅ | ⚠️ Placeholder | Need to build UI |
| **Login/Register** | ✅ | ✅ | ⚠️ Placeholder | Need to build forms |
| **Admin Panel** | ✅ | ✅ | ⚠️ Placeholder | Need to build CRUD |
| **Social Feed** | ✅ | ❌ | ❌ | Not implemented anywhere |
| **Mobile Wallet** | ✅ | ❌ | ❌ | Not implemented anywhere |
| **Live Features** | ✅ | ❌ | ❌ | Not implemented anywhere |

---

## 🎯 What Should Be Built (Priority Order)

### Phase 1: Core User Journey (2-3 weeks)

**Priority**: ⭐⭐⭐ CRITICAL

1. **Events Page** (3-4 days)
   ```
   Required Features:
   - Grid layout (like Landing Page cards)
   - Filter by genre
   - Filter by date
   - Search by name
   - Sort options (date, price, popularity)
   - Pagination or infinite scroll

   GraphQL Query: Already exists
   Design Pattern: Use Landing Page cards as template
   ```

2. **Event Detail Page** (3-4 days)
   ```
   Required Features:
   - Hero image + title
   - Date, time, venue info
   - DJ lineup
   - Ticket options (pricing tiers)
   - "Add to Cart" button
   - Event description
   - Venue map
   - User reviews section
   - Related events

   GraphQL Query: Need to create
   Design: Similar to landing hero section
   ```

3. **DJ List Page** (2-3 days)
   ```
   Required Features:
   - Grid of DJ cards
   - Profile picture
   - Name + stage name
   - Genre tags
   - Follower count
   - "Follow" button
   - Filter by genre
   - Search by name

   GraphQL Query: Already exists
   Design: Card grid like events
   ```

4. **DJ Profile Page** (4-5 days)
   ```
   Required Features:
   - Hero section with cover image
   - Profile picture
   - Name, stage name, bio
   - Social media links (13 platforms)
   - Top 10 tracks
   - Upcoming events
   - Follower count + Follow button
   - Photo/video gallery
   - Reviews

   GraphQL Query: Already exists (dj by ID)
   Design: Like event detail but DJ-focused
   ```

5. **Authentication Pages** (2-3 days)
   ```
   Login Page:
   - Email field
   - Password field
   - "Remember me" checkbox
   - "Forgot password" link
   - Social login buttons (optional)
   - "Sign up" link

   Register Page:
   - Full name
   - Email
   - Password + confirm
   - Role selection (User vs DJ)
   - Terms acceptance
   - "Already have account" link

   GraphQL Mutations: Already exist
   Design: Centered card, minimal
   ```

### Phase 2: Shopping Flow (1-2 weeks)

6. **Shopping Cart** (2-3 days)
   ```
   Features:
   - List of items
   - Quantity adjustment
   - Remove items
   - Subtotal calculation
   - "Continue Shopping" button
   - "Proceed to Checkout" button

   State: Use Zustand or Apollo Cache
   ```

7. **Checkout Page** (3-4 days)
   ```
   Features:
   - Order summary
   - User info form (if not logged in)
   - Payment method selection
   - Promo code input
   - Total calculation
   - "Place Order" button
   - Order confirmation

   Backend: Payment service exists
   Integration: Stripe or PayPal
   ```

### Phase 3: User Dashboard (1 week)

8. **Dashboard Page** (2-3 days)
   ```
   Features:
   - Welcome message
   - Upcoming tickets
   - Recent orders
   - Points + level (gamification)
   - Badges earned
   - Quick actions (upload media, buy tickets)

   GraphQL: Multiple queries combined
   ```

9. **Tickets Page** (1-2 days)
   ```
   Features:
   - List of purchased tickets
   - QR code display
   - Event details
   - Download ticket
   - "Add to Wallet" button (future)

   GraphQL: User tickets query
   ```

10. **Orders History** (1-2 days)
    ```
    Features:
    - List of all orders
    - Order details
    - Status tracking
    - Invoice download
    - Reorder button

    GraphQL: User orders query
    ```

### Phase 4: Admin Panel (1 week)

11. **Admin Dashboard** (1 day)
    ```
    Features:
    - Summary stats
    - Recent orders
    - User count
    - Event count
    - Revenue chart
    ```

12. **Admin Events CRUD** (2-3 days)
    ```
    Features:
    - List all events
    - Create new event
    - Edit event
    - Delete event
    - Image upload
    - DJ assignment
    ```

13. **Admin Venues CRUD** (1-2 days)
    ```
    Features:
    - List venues
    - Create venue
    - Edit venue
    - Delete venue
    ```

14. **Admin DJs CRUD** (1-2 days)
    ```
    Features:
    - List DJs
    - Create DJ profile
    - Edit DJ (already partially built)
    - Delete DJ
    - Image upload (exists)
    ```

### Phase 5: Media & Social (2 weeks)

15. **Gallery Page** (3-4 days)
    ```
    Features:
    - Masonry grid layout
    - Image/video thumbnails
    - Modal viewer
    - Like button
    - Comment section
    - Filter by event
    - Filter by user

    Backend: MediaItem model exists
    ```

16. **Upload Media Page** (2-3 days)
    ```
    Features:
    - File picker
    - Image preview
    - Multiple upload
    - Caption input
    - Event tagging
    - DJ tagging
    - Hashtags

    Backend: Already exists
    ```

17. **Gamification Page** (3-4 days)
    ```
    Features:
    - User points display
    - Level progression
    - Leaderboard
    - Badge collection
    - Achievement list
    - Progress bars

    Backend: Models exist
    ```

### Phase 6: Advanced Features (3-4 weeks)

18. **Social Feed** (1-2 weeks)
    ```
    NEW BACKEND NEEDED:
    - UserPost model
    - PostComment model
    - PostLike model
    - Feed algorithm service

    FRONTEND:
    - Feed page
    - Post creation
    - Like/comment UI
    - Hashtag pages
    - User profiles

    Reference: Mockups/01-user-content-feed.html
    Complexity: HIGH
    ```

19. **Mobile Wallet Integration** (1 week)
    ```
    BACKEND:
    - PassKit integration
    - Google Wallet API
    - Pass generation service
    - QR code generation

    FRONTEND:
    - "Add to Wallet" button
    - Pass preview

    Reference: Mockups/02-mobile-wallet-tickets.html
    Complexity: MEDIUM
    ```

20. **Live Event Features** (1-2 weeks)
    ```
    BACKEND:
    - WebSocket support
    - Real-time data service
    - Check-in tracking
    - Chat service

    FRONTEND:
    - Live timeline
    - Venue map
    - Chat UI
    - Energy meter

    Reference: Mockups/03-live-event-features.html
    Complexity: HIGH
    ```

---

## 🛠️ How to Rebuild

### Step 1: Use Landing Page as Template

The `LandingPage.tsx` is your **gold standard**. Every other page should follow its patterns:

```typescript
// Pattern to follow:
1. Import useQuery from Apollo
2. Define GraphQL query in queries.ts
3. Use loading and error states
4. Render data with Tailwind classes
5. Use responsive grid layouts
6. Apply hover effects
7. Use orange accent colors
8. Maintain dark theme
```

**Example - Building Events Page**:

```typescript
// 1. Add query to queries.ts
export const GET_ALL_EVENTS = gql`
  query GetAllEvents {
    events {
      id
      title
      description
      date
      price
      imageUrl
      venue { name city }
    }
  }
`;

// 2. Create EventsPage.tsx
import { useQuery } from '@apollo/client';
import { GET_ALL_EVENTS } from '../graphql/queries';

const EventsPage = () => {
  const { data, loading, error } = useQuery(GET_ALL_EVENTS);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  const events = data?.events ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold">Upcoming Events</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
};

// 3. Create reusable EventCard component
// Copy card structure from LandingPage.tsx lines 129-151
```

### Step 2: Backend GraphQL Queries Needed

These queries need to be added to `Program.cs`:

```csharp
// Event detail with full info
public async Task<object?> Event(Guid id, [Service] IEventService events)

// DJ list with filters
public async Task<IEnumerable<DJProfileListItemDto>> FilterDJs(
    string? genre,
    [Service] IDJService djs)

// User tickets
public async Task<IEnumerable<TicketDto>> MyTickets(
    [Service] ITicketService tickets,
    ClaimsPrincipal user)

// User orders
public async Task<IEnumerable<OrderDto>> MyOrders(
    [Service] IOrderService orders,
    ClaimsPrincipal user)

// Media gallery
public async Task<IEnumerable<MediaItemDto>> Gallery(
    Guid? eventId,
    [Service] IMediaService media)
```

### Step 3: Priority Implementation Order

**Week 1**: Events + DJs
- Day 1-2: Events listing page
- Day 3-4: Event detail page
- Day 5: DJ listing page
- Day 6-7: DJ profile page

**Week 2**: Auth + Shopping
- Day 1-2: Login/Register pages
- Day 3: Shopping cart
- Day 4-5: Checkout flow

**Week 3**: User Dashboard + Admin
- Day 1-3: Dashboard, Tickets, Orders
- Day 4-7: Admin CRUD pages

**Week 4**: Media + Polish
- Day 1-3: Gallery + Upload
- Day 4-5: Gamification
- Day 6-7: Testing + bug fixes

---

## 📝 Summary

### What You Thought Existed:
- Comprehensive frontend implementation
- Social feed
- Mobile wallet integration
- Live event features
- DJ galleries with media
- Admin panels with CRUD

### What Actually Exists:
- ✅ Exceptional backend (100% complete)
- ✅ One showcase landing page
- ✅ Detailed mockups (HTML files)
- ✅ Comprehensive documentation
- ✅ Clear vision and roadmap

### What Needs to Be Built:
- ⚠️ 18 frontend pages (placeholder → functional)
- ⚠️ Authentication UI
- ⚠️ Shopping flow UI
- ⚠️ Admin panel UI
- ⚠️ Media gallery UI
- ⚠️ Gamification UI

### The Good News:
1. Backend is rock-solid
2. Design system is proven (landing page)
3. Clear templates to follow
4. Mockups show exactly what to build
5. GraphQL API mostly ready
6. Path forward is clear

### The Reality:
- **~60% of work remains** (mostly frontend)
- **Backend: 90% done**
- **Frontend: 10% done**
- **Estimated time to completion: 8-12 weeks** with dedicated developer

---

## 🎯 Immediate Next Steps

1. **Pick Phase 1, Task 1**: Build Events Page
   - Use landing page cards as template
   - Connect to existing `events()` GraphQL query
   - Add filtering (copy pattern from mockups)
   - Estimated: 3-4 days

2. **Test Against Real Data**:
   - Backend is running
   - Database has sample data
   - GraphQL Playground at http://localhost:5000/graphql
   - Test queries before building UI

3. **Follow the Pattern**:
   - Every page follows landing page structure
   - Reuse components (Header, Footer, Layout)
   - Consistent Tailwind classes
   - Dark theme + orange accents

---

**The project has incredible potential. The architecture is sound. The vision is clear. Now it's time to build the frontend that matches the backend's quality.**

---

**End of Report**

*For questions, refer to:*
- *FEATURE-PRESENTATION.md - User flows*
- *FEATURE-ENHANCEMENT-GUIDE.md - Implementation specs*
- *Mockups/*.html - Visual reference*
- *PROJECT-RECONSTRUCTION-REPORT.md - Current state*
