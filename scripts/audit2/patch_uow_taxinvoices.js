const fs = require('fs');

// 1. IUnitOfWork.cs
let iUow = fs.readFileSync('backend/Marketplace.Application/Interfaces/IUnitOfWork.cs', 'utf8');
if (!iUow.includes('TaxInvoices')) {
    iUow = iUow.replace(
        'IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches { get; }',
        'IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches { get; }\r\n    IRepository<TaxInvoice> TaxInvoices { get; }'
    );
    fs.writeFileSync('backend/Marketplace.Application/Interfaces/IUnitOfWork.cs', iUow, 'utf8');
    console.log('1. IUnitOfWork.cs updated.');
}

// 2. UnitOfWork.cs
let uow = fs.readFileSync('backend/Marketplace.Infrastructure/Repositories/UnitOfWork.cs', 'utf8');
if (!uow.includes('TaxInvoices')) {
    uow = uow.replace(
        'CarrierRemittanceBatches = new Repository<CarrierRemittanceBatch>(context);',
        'CarrierRemittanceBatches = new Repository<CarrierRemittanceBatch>(context);\r\n        TaxInvoices = new Repository<TaxInvoice>(context);'
    );
    uow = uow.replace(
        'public IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches { get; }',
        'public IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches { get; }\r\n    public IRepository<TaxInvoice> TaxInvoices { get; }'
    );
    fs.writeFileSync('backend/Marketplace.Infrastructure/Repositories/UnitOfWork.cs', uow, 'utf8');
    console.log('2. UnitOfWork.cs updated.');
}

// 3. FakeUnitOfWork in FileSecurityAndValidationTests.cs
let fakeUow = fs.readFileSync('backend/Marketplace.Tests/FileSecurityAndValidationTests.cs', 'utf8');
if (!fakeUow.includes('TaxInvoices')) {
    fakeUow = fakeUow.replace(
        'public IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches => throw new NotImplementedException();',
        'public IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches => throw new NotImplementedException();\r\n    public IRepository<TaxInvoice> TaxInvoices => throw new NotImplementedException();'
    );
    fs.writeFileSync('backend/Marketplace.Tests/FileSecurityAndValidationTests.cs', fakeUow, 'utf8');
    console.log('3. FileSecurityAndValidationTests.cs updated.');
}

// 4. AppDbContext.cs
let appDbContext = fs.readFileSync('backend/Marketplace.Infrastructure/Data/AppDbContext.cs', 'utf8');
if (!appDbContext.includes('DbSet<TaxInvoice> TaxInvoices')) {
    appDbContext = appDbContext.replace(
        'public DbSet<CarrierRemittanceBatch> CarrierRemittanceBatches => Set<CarrierRemittanceBatch>();',
        'public DbSet<CarrierRemittanceBatch> CarrierRemittanceBatches => Set<CarrierRemittanceBatch>();\r\n    public DbSet<TaxInvoice> TaxInvoices => Set<TaxInvoice>();'
    );

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

    // Insert right before OnModelCreating closing brace
    const marker = '        // --- CarrierRemittanceBatch --------------------------------';
    if (appDbContext.includes(marker)) {
        appDbContext = appDbContext.replace(marker, taxInvoiceConfig + '\r\n' + marker);
        fs.writeFileSync('backend/Marketplace.Infrastructure/Data/AppDbContext.cs', appDbContext, 'utf8');
        console.log('4. AppDbContext.cs updated with TaxInvoice.');
    }
}
