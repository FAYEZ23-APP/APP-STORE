const fs = require('fs');
let appDbContext = fs.readFileSync('backend/Marketplace.Infrastructure/Data/AppDbContext.cs', 'utf8');

if (!appDbContext.includes('DbSet<TaxInvoice> TaxInvoices')) {
    appDbContext = appDbContext.replace(
        'public DbSet<CarrierRemittanceBatch> CarrierRemittanceBatches => Set<CarrierRemittanceBatch>();',
        'public DbSet<CarrierRemittanceBatch> CarrierRemittanceBatches => Set<CarrierRemittanceBatch>();\r\n    public DbSet<TaxInvoice> TaxInvoices => Set<TaxInvoice>();'
    );
}

const taxInvoiceConfig = `
        // --- TaxInvoice ---------------------------------------------
        modelBuilder.Entity<TaxInvoice>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.ToTable("TaxInvoices");

            entity.Property(t => t.InvoiceNumber)
                .HasMaxLength(100)
                .IsRequired();
            entity.HasIndex(t => t.InvoiceNumber)
                .IsUnique();

            entity.Property(t => t.EtaUuid)
                .HasMaxLength(100)
                .IsRequired();
            entity.HasIndex(t => t.EtaUuid)
                .IsUnique();

            entity.Property(t => t.InvoiceType)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(t => t.Status)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(t => t.SubtotalAmount)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(t => t.VatRate)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(t => t.VatAmount)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(t => t.TotalAmount)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(t => t.QrCodePayload)
                .HasMaxLength(2000);

            entity.HasOne(t => t.Order)
                .WithMany()
                .HasForeignKey(t => t.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.Shipment)
                .WithMany()
                .HasForeignKey(t => t.ShipmentId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(t => t.Seller)
                .WithMany()
                .HasForeignKey(t => t.SellerId)
                .OnDelete(DeleteBehavior.SetNull);
        });
`;

const marker = '            // --- CarrierRemittanceBatch -----------------------------';
if (appDbContext.includes(marker) && !appDbContext.includes('entity.ToTable("TaxInvoices");')) {
    appDbContext = appDbContext.replace(marker, taxInvoiceConfig + '\r\n' + marker);
    fs.writeFileSync('backend/Marketplace.Infrastructure/Data/AppDbContext.cs', appDbContext, 'utf8');
    console.log('AppDbContext.cs updated with TaxInvoice.');
}
