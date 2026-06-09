# Repository Pattern Implementation

This project implements a clean repository pattern with Entity Framework Core, following clean architecture principles.

## Architecture Overview

### Layers
- **Domain**: Contains entities and domain logic
- **Application**: Contains interfaces, DTOs, and business logic
- **Infrastructure**: Contains data access implementations

### Repository Pattern Components

#### 1. Generic Repository Interface (`IRepository<T>`)
Provides common CRUD operations for all entities:
```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(object id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<T> AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(T entity);
    Task<bool> ExistsAsync(object id);
    Task<int> SaveChangesAsync();
}
```

#### 2. Specific Repository Interfaces
Each entity has its own repository interface with domain-specific methods:

- `IUserRepository`: User-specific operations
- `IEventRepository`: Event-specific operations
- `ITicketRepository`: Ticket-specific operations
- `IOrderRepository`: Order-specific operations
- `IPaymentRepository`: Payment-specific operations
- `IDJProfileRepository`: DJ Profile-specific operations

#### 3. Repository Implementations
All repositories are implemented in the Infrastructure layer:
- `Repository<T>`: Generic implementation
- `UserRepository`: User-specific implementation
- `EventRepository`: Event-specific implementation
- etc.

#### 4. Unit of Work Pattern
The `IUnitOfWork` interface coordinates multiple repositories and manages transactions:

```csharp
public interface IUnitOfWork : IDisposable
{
    IUserRepository Users { get; }
    IEventRepository Events { get; }
    // ... other repositories
    
    Task<int> SaveChangesAsync();
    Task BeginTransactionAsync();
    Task CommitTransactionAsync();
    Task RollbackTransactionAsync();
}
```

## Usage Examples

### Basic CRUD Operations
```csharp
public class UserService
{
    private readonly IUnitOfWork _unitOfWork;

    public UserService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<UserDetailsDto?> GetUserByIdAsync(string userId)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(userId);
        if (user == null) return null;

        return new UserDetailsDto
        {
            FullName = user.FullName,
            Email = user.Email
        };
    }

    public async Task CreateUserAsync(RegisterUserDto userDto)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid().ToString(),
            FullName = userDto.FullName,
            Email = userDto.Email,
            Provider = userDto.Provider
        };

        await _unitOfWork.Users.AddAsync(user);
        await _unitOfWork.SaveChangesAsync();
    }
}
```

### Complex Queries with Includes
```csharp
public async Task<IEnumerable<Event>> GetUpcomingEventsAsync()
{
    return await _unitOfWork.Events.GetUpcomingEventsAsync();
    // This includes Venue, Genres, and EventDJs automatically
}
```

### Transaction Management
```csharp
public async Task CreateOrderWithPaymentAsync(CreateOrderDto orderDto)
{
    try
    {
        await _unitOfWork.BeginTransactionAsync();

        // Create order
        var order = new Order { /* ... */ };
        await _unitOfWork.Orders.AddAsync(order);

        // Create payment
        var payment = new Payment { /* ... */ };
        await _unitOfWork.Payments.AddAsync(payment);

        await _unitOfWork.SaveChangesAsync();
        await _unitOfWork.CommitTransactionAsync();
    }
    catch
    {
        await _unitOfWork.RollbackTransactionAsync();
        throw;
    }
}
```

## Dependency Injection Setup

The repositories and Unit of Work are registered in `Program.cs`:

```csharp
// Register repositories and Unit of Work
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IEventRepository, EventRepository>();
// ... other repositories

// Register services
builder.Services.AddScoped<IUserService, UserService>();
```

## Benefits

1. **Separation of Concerns**: Data access logic is separated from business logic
2. **Testability**: Easy to mock repositories for unit testing
3. **Maintainability**: Changes to data access don't affect business logic
4. **Flexibility**: Easy to switch between different data sources
5. **Transaction Management**: Unit of Work pattern ensures data consistency
6. **Performance**: Includes and eager loading are handled at the repository level

## Best Practices

1. **Always use the Unit of Work pattern** for coordinating multiple repositories
2. **Use specific repository interfaces** for domain-specific queries
3. **Include related entities** when needed using the repository methods
4. **Handle transactions properly** using BeginTransaction/CommitTransaction/RollbackTransaction
5. **Keep repositories focused** on data access, not business logic
6. **Use async/await** for all database operations

## File Structure

```
Application/
├── Interfaces/
│   ├── IRepository.cs
│   ├── IUserRepository.cs
│   ├── IEventRepository.cs
│   └── IUnitOfWork.cs
└── Services/
    └── UserService.cs

Infrastructure/
└── Persistance/
    ├── Repositories/
    │   ├── Repository.cs
    │   ├── UserRepository.cs
    │   ├── EventRepository.cs
    │   └── ...
    ├── AppDbContext.cs
    └── UnitOfWork.cs
``` 