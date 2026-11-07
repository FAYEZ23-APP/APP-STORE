const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../backend/Marketplace.Infrastructure/Data/AppDbContext.cs');
let content = fs.readFileSync(filePath, 'utf8');

// Add DbSets
const targetDbSet = 'public DbSet<PrivacyIncidentLog> PrivacyIncidentLogs => Set<PrivacyIncidentLog>();';
const newDbSets = `public DbSet<PrivacyIncidentLog> PrivacyIncidentLogs => Set<PrivacyIncidentLog>();
    public DbSet<ExchangeRequest> ExchangeRequests => Set<ExchangeRequest>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<SupportTicketMessage> SupportTicketMessages => Set<SupportTicketMessage>();`;

if (!content.includes('public DbSet<ExchangeRequest> ExchangeRequests')) {
    content = content.replace(targetDbSet, newDbSets);
}

// Add entity configurations before the end of OnModelCreating
const targetModelCreating = 'entity.HasOne(pil => pil.ReportedByAdmin).WithMany(u => u.ReportedIncidents).HasForeignKey(pil => pil.ReportedByAdminId).OnDelete(DeleteBehavior.SetNull);\r\n        });\r\n\r\n    }';
const targetModelCreatingLf = 'entity.HasOne(pil => pil.ReportedByAdmin).WithMany(u => u.ReportedIncidents).HasForeignKey(pil => pil.ReportedByAdminId).OnDelete(DeleteBehavior.SetNull);\n        });\n\n    }';

const newEntityConfigs = `

        // --- ExchangeRequest ------------------------------------
        modelBuilder.Entity<ExchangeRequest>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Reason).IsRequired().HasMaxLength(500);
            entity.Property(e => e.RequestedSize).HasMaxLength(50);
            entity.Property(e => e.RequestedColor).HasMaxLength(50);
            entity.Property(e => e.Status).IsRequired().HasConversion<string>().HasMaxLength(30);
            entity.Property(e => e.RejectionReason).HasMaxLength(500);
            entity.HasIndex(e => e.OrderId);
            entity.HasIndex(e => e.BuyerId);
            entity.HasIndex(e => e.SellerId);
            entity.HasIndex(e => e.Status);

            entity.HasOne(e => e.Order).WithMany().HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.OrderItem).WithMany().HasForeignKey(e => e.OrderItemId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Buyer).WithMany().HasForeignKey(e => e.BuyerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Seller).WithMany().HasForeignKey(e => e.SellerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.ReplacementShipment).WithMany().HasForeignKey(e => e.ReplacementShipmentId).OnDelete(DeleteBehavior.SetNull);
        });

        // --- SupportTicket ---------------------------------------
        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Subject).IsRequired().HasMaxLength(200);
            entity.Property(t => t.Category).IsRequired().HasMaxLength(50);
            entity.Property(t => t.Priority).IsRequired().HasMaxLength(20);
            entity.Property(t => t.Status).IsRequired().HasMaxLength(30);
            entity.HasIndex(t => t.UserId);
            entity.HasIndex(t => t.Status);
            entity.HasIndex(t => t.Category);
            entity.HasIndex(t => t.CreatedAt);

            entity.HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(t => t.Order).WithMany().HasForeignKey(t => t.OrderId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(t => t.Shipment).WithMany().HasForeignKey(t => t.ShipmentId).OnDelete(DeleteBehavior.SetNull);
            entity.HasMany(t => t.Messages).WithOne(m => m.Ticket).HasForeignKey(m => m.TicketId).OnDelete(DeleteBehavior.Cascade);
        });

        // --- SupportTicketMessage --------------------------------
        modelBuilder.Entity<SupportTicketMessage>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.SenderRole).IsRequired().HasMaxLength(30);
            entity.Property(m => m.Message).IsRequired().HasMaxLength(4000);
            entity.Property(m => m.AttachmentUrl).HasMaxLength(500);
            entity.HasIndex(m => m.TicketId);

            entity.HasOne(m => m.Sender).WithMany().HasForeignKey(m => m.SenderId).OnDelete(DeleteBehavior.Restrict);
        });
`;

if (!content.includes('modelBuilder.Entity<ExchangeRequest>')) {
    if (content.includes(targetModelCreating)) {
        content = content.replace(targetModelCreating, targetModelCreating.replace('\r\n\r\n    }', newEntityConfigs + '\r\n    }'));
    } else if (content.includes(targetModelCreatingLf)) {
        content = content.replace(targetModelCreatingLf, targetModelCreatingLf.replace('\n\n    }', newEntityConfigs + '\n    }'));
    } else {
        const lastClosingIndex = content.lastIndexOf('    }');
        content = content.slice(0, lastClosingIndex) + newEntityConfigs + '\n' + content.slice(lastClosingIndex);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched AppDbContext.cs');
