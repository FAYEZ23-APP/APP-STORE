const fs = require('fs');
const path = require('path');

const dbContextPath = path.join(__dirname, '../../backend/Marketplace.Infrastructure/Data/AppDbContext.cs');
let content = fs.readFileSync(dbContextPath, 'utf8');

const wrongBlock = `        // --- CarrierRemittanceBatch -----------------------------
        modelBuilder.Entity<CarrierRemittanceBatch>(entity =>
        {
            entity.HasKey(b => b.Id);
            entity.Property(b => b.BatchReference).IsRequired().HasMaxLength(100);
            entity.Property(b => b.CarrierName).IsRequired().HasMaxLength(100);
            entity.Property(b => b.Status).IsRequired().HasMaxLength(50);
            entity.Property(b => b.ExpectedCodTotal).HasPrecision(18, 2);
            entity.Property(b => b.ActualRemittedTotal).HasPrecision(18, 2);
            entity.Property(b => b.CarrierFeesTotal).HasPrecision(18, 2);
            entity.Property(b => b.NetSettledTotal).HasPrecision(18, 2);
            entity.HasIndex(b => b.BatchReference).IsUnique();
            entity.HasIndex(b => b.CreatedAt);

            entity.HasOne(b => b.UploadedByAdmin).WithMany().HasForeignKey(b => b.UploadedByAdminId).OnDelete(DeleteBehavior.Restrict);
        });`;

content = content.replace(wrongBlock, '');

// Place it before the closing brace of OnModelCreating
const marker = 'public void AssertSafeForDestructiveOperations()';
const markerIndex = content.indexOf(marker);
const lastBraceBeforeMarker = content.lastIndexOf('}', markerIndex);

content = content.slice(0, lastBraceBeforeMarker) + wrongBlock + '\n    }' + content.slice(lastBraceBeforeMarker + 1);

fs.writeFileSync(dbContextPath, content, 'utf8');
console.log('Fixed CarrierRemittanceBatch location in AppDbContext.cs');
