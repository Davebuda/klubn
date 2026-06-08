# Application

Business-logic layer. Services orchestrate work through repositories; this layer defines the
**interfaces** (services *and* repositories), **DTOs**, and **Options**. References `Domain` only.

Namespaces: `DJDiP.Application.Services` / `.Interfaces` / `.DTO` / `.Options`.

## What belongs here
- `Services/` — one class per domain area (19 today: `EventService`, `UserService`, `AuthService`,
  `TicketService`, `DJService`, `GalleryMediaService`, `PlaylistService`, `DJMixService`, …).
- `Interfaces/` — service interfaces (`IEventService`, `IAuthService`, …) **and** repository interfaces
  (`IRepository`, `IEventRepository`, `IUnitOfWork`, `IOrderRepository`, …). Repos are *defined* here, *implemented* in `Infrastructure`.
- `DTO/` — request/response shapes returned to the GraphQL/REST layer (`DTO/EventDTO/EventListDto`, `EventVenueDto`, …).
- `Options/` — strongly-typed config bound from settings: `AuthSettings.cs`, `EmailSettings.cs`.

## What does NOT belong here
- **No `AppDbContext` / EF queries** — go through `IUnitOfWork` + repositories (implemented in `Infrastructure`).
- **No HTTP / controller / HotChocolate code** — that's `API/` and `Program.cs`.
- **No entity definitions** — those are in `Domain/Models/`.

## Conventions
Based on `EventService.cs`, `AuthService.cs` + the interface/DI listing.
- **Constructor-inject `IUnitOfWork`; never `AppDbContext` directly.** Reach repos as `_unitOfWork.Events`, `_unitOfWork.Users`, etc.
- Each service implements exactly one `I*` interface; public methods are `async` and `*Async`.
- **Map entities → DTOs inside the service** (`.Select(e => new EventListDto { … })`); don't leak `Domain` entities upward where a DTO exists.
- Services are registered `Scoped` in `Program.cs:152-173`. When you add a service: create `IFooService` + `FooService`, then register it there.
- Filtering/business rules live here, e.g. `EventService.GetAllAsync()` returns only `Status == "Published"`.

## Gotchas
- **Impl-name mismatch:** `IEventService` is registered to **`EventServiceImpl`** (`Program.cs:156`), even though `EventService.cs` also implements `IEventService`. Check the DI registration to know which class is live before editing.
- Interface filename typos exist (`INewsLetterServices.cs`, `UserIService.cs`, `ISong.cs`) — match the existing filename when editing; don't "correct" a name without updating all references.
- `Class1.cs` is an empty scaffold leftover — delete-on-sight candidate, never add code to it.
