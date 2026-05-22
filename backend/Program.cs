using Backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=marketplace.db"));

var app = builder.Build();

// Ensure Database is created and seeded
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    
    // Seed an initial user and a class session
    if (!db.Users.Any())
    {
        db.Users.Add(new User { Id = "admin", GymStarCoins = 5000 });
        db.Users.Add(new User { Id = "john", GymStarCoins = 1000 });
        db.SaveChanges();
    }
    
    if (!db.ClassSessions.Any())
    {
        var upcomingSaturday = DateTime.Today.AddDays((int)DayOfWeek.Saturday - (int)DateTime.Today.DayOfWeek);
        if (upcomingSaturday <= DateTime.Today) upcomingSaturday = upcomingSaturday.AddDays(7);
        
        db.ClassSessions.Add(new ClassSession { Date = upcomingSaturday.AddHours(10), Capacity = 50 }); // 10 AM Saturday
        db.SaveChanges();
    }
}

app.UseCors();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Ensure proper routing for SPA
app.UseRouting();

// Helper to handle auction expiration
void ExpireAuctions(AppDbContext db)
{
    var expiredAuctions = db.Auctions
        .Include(a => a.Bids)
        .Where(a => a.ExpirationDate <= DateTime.UtcNow && a.WinnerId == null)
        .ToList();
        
    foreach (var auction in expiredAuctions)
    {
        var highestBid = auction.Bids.OrderByDescending(b => b.Amount).FirstOrDefault();
        if (highestBid != null)
        {
            auction.WinnerId = highestBid.UserId;
            // Transfer ownership
            var booking = db.Bookings.Find(auction.BookingId);
            if (booking != null)
            {
                var originalOwner = db.Users.Find(booking.UserId);
                var newOwner = db.Users.Find(highestBid.UserId);
                if (originalOwner != null && newOwner != null)
                {
                    // Deduct coins from new owner, add to original
                    newOwner.GymStarCoins -= highestBid.Amount;
                    originalOwner.GymStarCoins += highestBid.Amount;
                    
                    booking.UserId = highestBid.UserId;
                }
            }
        }
        else
        {
            // No bids, auction just expires
            auction.WinnerId = string.Empty; // Just a marker that it finished
        }
    }
    if (expiredAuctions.Any())
    {
        db.SaveChanges();
    }
}

// API Endpoints
var api = app.MapGroup("/api");

api.MapGet("/me/{userId}", (AppDbContext db, string userId) =>
{
    ExpireAuctions(db); // Cheap way to run logic for now
    var user = db.Users.Find(userId);
    if (user == null)
    {
        user = new User { Id = userId, GymStarCoins = 1000 };
        db.Users.Add(user);
        db.SaveChanges();
    }
    return Results.Ok(user);
});

api.MapGet("/my-bookings/{userId}", (AppDbContext db, string userId) =>
{
    ExpireAuctions(db);
    var bookings = db.Bookings
        .Include(b => b.ClassSession)
        .Include(b => b.Auction)
        .Where(b => b.UserId == userId)
        .Select(b => new
        {
            b.Id,
            b.ClassSession.Date,
            HasAuction = b.Auction != null,
            AuctionActive = b.Auction != null && b.Auction.WinnerId == null && b.Auction.ExpirationDate > DateTime.UtcNow
        }).ToList();
    return Results.Ok(bookings);
});

api.MapPost("/auctions/sell", (AppDbContext db, [FromQuery] string userId, [FromQuery] int startingPrice, [FromQuery] int durationHours) =>
{
    var user = db.Users.Find(userId);
    if (user == null) return Results.BadRequest("User not found.");

    // We assume the user has a spot to sell, so we just register the booking and list it
    var session = db.ClassSessions.OrderBy(c => c.Date).First();

    var booking = new Booking { ClassSessionId = session.Id, UserId = userId };
    db.Bookings.Add(booking);
    
    var auction = new Auction
    {
        Booking = booking,
        StartingPrice = startingPrice,
        ExpirationDate = DateTime.UtcNow.AddHours(durationHours)
    };
    db.Auctions.Add(auction);
    db.SaveChanges();
    return Results.Ok(auction);
});

api.MapGet("/auctions", (AppDbContext db) =>
{
    ExpireAuctions(db);
    var auctions = db.Auctions
        .Include(a => a.Booking).ThenInclude(b => b.ClassSession)
        .Include(a => a.Bids)
        .Where(a => a.WinnerId == null && a.ExpirationDate > DateTime.UtcNow)
        .Select(a => new
        {
            a.Id,
            a.Booking.ClassSession.Date,
            OriginalOwner = a.Booking.UserId,
            a.StartingPrice,
            a.ExpirationDate,
            HighestBid = a.Bids.OrderByDescending(b => b.Amount).Select(b => b.Amount).FirstOrDefault(),
            BidsCount = a.Bids.Count
        }).ToList();
    return Results.Ok(auctions);
});

api.MapPost("/auctions/{id}/bid", (AppDbContext db, int id, [FromQuery] string userId, [FromQuery] int amount) =>
{
    var auction = db.Auctions.Include(a => a.Bids).Include(a => a.Booking).FirstOrDefault(a => a.Id == id);
    if (auction == null) return Results.NotFound("Auction not found.");
    if (auction.WinnerId != null || auction.ExpirationDate <= DateTime.UtcNow) return Results.BadRequest("Auction ended.");
    if (auction.Booking.UserId == userId) return Results.BadRequest("Cannot bid on your own spot.");
    
    var user = db.Users.Find(userId);
    if (user == null) return Results.BadRequest("User not found.");
    if (user.GymStarCoins < amount) return Results.BadRequest("Not enough GymStar coins.");

    var currentHighest = auction.Bids.OrderByDescending(b => b.Amount).Select(b => b.Amount).FirstOrDefault();
    if (amount <= currentHighest || amount < auction.StartingPrice) return Results.BadRequest("Bid too low.");

    var bid = new Bid
    {
        AuctionId = id,
        UserId = userId,
        Amount = amount
    };
    db.Bids.Add(bid);
    db.SaveChanges();
    return Results.Ok(bid);
});

// Fallback to index.html for SPA routing
app.MapFallbackToFile("index.html");

app.Run();

