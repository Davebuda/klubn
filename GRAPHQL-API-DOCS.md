# DJ-DiP GraphQL API Documentation

## Overview
The DJ-DiP GraphQL API provides complete access to event management, DJ profiles, ticketing, orders, payments, and more.

**Endpoint:** `http://localhost:5000/graphql`

## Quick Start

### Access GraphQL Playground
Open your browser and navigate to: `http://localhost:5000/graphql`

The GraphQL playground provides:
- Interactive query builder
- Schema documentation
- Query history
- Auto-complete

---

## 🔍 Queries

### Landing Page
Get featured events and DJs for the homepage.

```graphql
query {
  landing {
    events {
      id
      title
      date
      price
      venue {
        name
        location
      }
    }
    djs {
      id
      name
      bio
    }
  }
}
```

### Events

#### Get All Events
```graphql
query {
  events {
    id
    title
    date
    price
    imageUrl
  }
}
```

#### Get Event Details
```graphql
query {
  event(id: "YOUR-EVENT-ID") {
    id
    title
    description
    date
    price
    venue {
      name
      location
      capacity
    }
    genres {
      name
    }
  }
}
```

#### Get Upcoming Events
```graphql
query {
  upcomingEvents {
    id
    title
    date
    price
  }
}
```

#### Get Events by Date
```graphql
query {
  eventsByDate(date: "2025-11-01T00:00:00Z") {
    id
    title
    date
  }
}
```

### DJs

#### Get All DJs
```graphql
query {
  djs {
    id
    name
    bio
    socialLinks
  }
}
```

#### Get DJ Profile
```graphql
query {
  dj(id: "YOUR-DJ-ID") {
    id
    name
    bio
    socialLinks
    genres {
      id
      name
    }
  }
}
```

#### Get DJ Top 10
```graphql
query {
  djTop10(djId: "YOUR-DJ-ID") {
    rank
    songTitle
    songArtist
    addedDate
  }
}
```

### Tickets

#### Get User Tickets
```graphql
query {
  userTickets(userId: "USER-ID") {
    id
    qrCode
    purchaseDate
    isUsed
    event {
      title
      date
    }
  }
}
```

#### Validate Ticket
```graphql
query {
  validateTicket(qrCode: "QR-CODE-HERE") {
    isValid
    message
    ticketId
    eventId
  }
}
```

### Orders

#### Get User Orders
```graphql
query {
  userOrders(userId: "USER-ID") {
    id
    orderDate
    totalAmount
    status
    itemCount
  }
}
```

#### Get Order Details
```graphql
query {
  order(id: "ORDER-ID") {
    id
    orderDate
    totalAmount
    status
    orderItems {
      eventTitle
      quantity
      unitPrice
      totalPrice
    }
    payment {
      amount
      paymentMethod
      status
      transactionId
    }
  }
}
```

### Search

#### Search Songs by Title
```graphql
query {
  searchSongsByTitle(title: "techno") {
    id
    title
    artist
    album
  }
}
```

#### Search Songs by Artist
```graphql
query {
  searchSongsByArtist(artist: "artist name") {
    id
    title
    artist
    album
  }
}
```

### Notifications

#### Get User Notifications
```graphql
query {
  userNotifications(userId: "USER-ID") {
    id
    title
    message
    type
    createdAt
    isRead
  }
}
```

#### Get Unread Count
```graphql
query {
  unreadCount(userId: "USER-ID")
}
```

---

## ✏️ Mutations

### Events

#### Create Event
```graphql
mutation {
  createEvent(input: {
    title: "Summer Festival 2025"
    description: "Amazing summer event"
    date: "2025-07-15T20:00:00Z"
    venueId: "VENUE-ID"
    price: 450.00
    imageUrl: "https://example.com/image.jpg"
    genreIds: ["GENRE-ID-1", "GENRE-ID-2"]
  }) {
    id
    title
    date
  }
}
```

#### Update Event
```graphql
mutation {
  updateEvent(
    id: "EVENT-ID"
    input: {
      title: "Updated Event Title"
      price: 500.00
    }
  ) {
    id
    title
    price
  }
}
```

#### Delete Event
```graphql
mutation {
  deleteEvent(id: "EVENT-ID")
}
```

### Orders & Payments

#### Create Order
```graphql
mutation {
  createOrder(input: {
    userId: "USER-ID"
    promotionCode: "WELCOME2024"
    orderItems: [
      {
        eventId: "EVENT-ID"
        quantity: 2
      }
    ]
  }) {
    id
    totalAmount
    status
    orderItems {
      eventTitle
      quantity
      totalPrice
    }
  }
}
```

#### Process Payment
```graphql
mutation {
  processPayment(input: {
    orderId: "ORDER-ID"
    paymentMethod: "Card"
  }) {
    id
    amount
    status
    transactionId
    paymentDate
  }
}
```

#### Apply Promotion Code
```graphql
mutation {
  applyPromotionCode(
    code: "WELCOME2024"
    originalPrice: 1000.00
  ) {
    isValid
    message
    discountPercentage
    originalPrice
    discountAmount
    finalPrice
  }
}
```

### Tickets

#### Scan Ticket
```graphql
mutation {
  scanTicket(qrCode: "QR-CODE-HERE") {
    success
    message
    ticketId
    scannedAt
  }
}
```

### Newsletter

#### Subscribe
```graphql
mutation {
  subscribe(input: {
    email: "user@example.com"
  }) {
    id
    email
    subscribedAt
    isActive
  }
}
```

#### Unsubscribe
```graphql
mutation {
  unsubscribe(input: {
    email: "user@example.com"
  })
}
```

### Contact Messages

#### Create Contact Message
```graphql
mutation {
  createContactMessage(input: {
    userId: "USER-ID"
    name: "John Doe"
    email: "john@example.com"
    subject: "Question about event"
    message: "I have a question..."
  }) {
    id
    createdAt
    isRead
  }
}
```

### DJ Management

#### Create DJ Profile
```graphql
mutation {
  createDJ(input: {
    name: "DJ NewStar"
    bio: "Emerging talent in techno scene"
    socialLinks: "instagram.com/djnewstar"
    genreIds: ["GENRE-ID"]
  }) {
    id
    name
    bio
  }
}
```

#### Add Song to DJ Top 10
```graphql
mutation {
  addToTop10(input: {
    djId: "DJ-ID"
    songId: "SONG-ID"
    rank: 1
  }) {
    id
    rank
    songTitle
    songArtist
  }
}
```

### Notifications

#### Mark Notification as Read
```graphql
mutation {
  markNotificationAsRead(id: "NOTIFICATION-ID")
}
```

#### Mark All as Read
```graphql
mutation {
  markAllNotificationsAsRead(userId: "USER-ID")
}
```

---

## 📋 Common Workflows

### Complete Ticket Purchase Flow

```graphql
# 1. Browse events
query {
  upcomingEvents {
    id
    title
    price
  }
}

# 2. Check promotion code
mutation {
  applyPromotionCode(code: "WELCOME2024", originalPrice: 350.00) {
    isValid
    finalPrice
  }
}

# 3. Create order
mutation {
  createOrder(input: {
    userId: "USER-ID"
    promotionCode: "WELCOME2024"
    orderItems: [{ eventId: "EVENT-ID", quantity: 1 }]
  }) {
    id
    totalAmount
  }
}

# 4. Process payment
mutation {
  processPayment(input: {
    orderId: "ORDER-ID"
    paymentMethod: "Card"
  }) {
    status
    transactionId
  }
}

# 5. View tickets
query {
  userTickets(userId: "USER-ID") {
    qrCode
    event {
      title
      date
    }
  }
}
```

### Event Check-in Flow

```graphql
# 1. Validate ticket
query {
  validateTicket(qrCode: "QR-CODE") {
    isValid
    message
  }
}

# 2. Scan ticket (marks as used)
mutation {
  scanTicket(qrCode: "QR-CODE") {
    success
    message
    scannedAt
  }
}
```

---

## 🔐 Authentication (Coming Soon)

Authentication will be added in Phase 3. Currently, all endpoints are public for development.

When implemented:
- JWT token authentication
- Role-based access control
- User sessions
- Secure mutations

---

## 💡 Tips

1. **Use Variables**: For dynamic queries, use GraphQL variables
2. **Request Only What You Need**: GraphQL lets you specify exact fields
3. **Explore Schema**: Use the Docs panel in GraphQL playground
4. **Error Handling**: Check the `errors` array in responses
5. **Pagination**: Will be added for large datasets

---

## 🐛 Error Handling

GraphQL returns errors in a standard format:

```json
{
  "errors": [
    {
      "message": "Event not found",
      "path": ["event"],
      "extensions": {
        "code": "NOT_FOUND"
      }
    }
  ]
}
```

Common error codes:
- `NOT_FOUND`: Resource doesn't exist
- `VALIDATION_ERROR`: Invalid input
- `UNAUTHORIZED`: Authentication required (future)
- `SERVER_ERROR`: Internal server error

---

## 📚 Additional Resources

- GraphQL Playground: http://localhost:5000/graphql
- Schema Documentation: Available in playground
- Sample Queries: See above examples
- Development Progress: See DEVELOPMENT-PROGRESS.md

---

## 🚀 Next Steps

Upcoming features:
- Authentication & Authorization
- Real-time subscriptions
- Advanced filtering & pagination
- File upload for images
- Rate limiting
- Caching layer
