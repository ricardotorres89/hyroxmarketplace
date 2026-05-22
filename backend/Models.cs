using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;

namespace Backend.Models;

public class User
{
    public string Id { get; set; } = string.Empty; // Username as ID
    public int GymStarCoins { get; set; } = 1000;
}

public class ClassSession
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public int Capacity { get; set; }
    public List<Booking> Bookings { get; set; } = new();
}

public class Booking
{
    public int Id { get; set; }
    public int ClassSessionId { get; set; }
    public ClassSession ClassSession { get; set; } = null!;
    public string UserId { get; set; } = string.Empty;
    public User User { get; set; } = null!;
    public Auction? Auction { get; set; }
}

public class Auction
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public DateTime ExpirationDate { get; set; }
    public int StartingPrice { get; set; }
    public string? WinnerId { get; set; }
    public bool IsActive => DateTime.UtcNow < ExpirationDate && WinnerId == null;
    
    public List<Bid> Bids { get; set; } = new();
}

public class Bid
{
    public int Id { get; set; }
    public int AuctionId { get; set; }
    public Auction Auction { get; set; } = null!;
    public string UserId { get; set; } = string.Empty;
    public User User { get; set; } = null!;
    public int Amount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<ClassSession> ClassSessions { get; set; }
    public DbSet<Booking> Bookings { get; set; }
    public DbSet<Auction> Auctions { get; set; }
    public DbSet<Bid> Bids { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Auction>()
            .HasOne(a => a.Booking)
            .WithOne(b => b.Auction)
            .HasForeignKey<Auction>(a => a.BookingId);
    }
}
