const fs = require('fs');
const path = require('path');

// 1. AppDbContext.cs
const dbContextPath = path.join(__dirname, '../../backend/Marketplace.Infrastructure/Data/AppDbContext.cs');
let dbContext = fs.readFileSync(dbContextPath, 'utf8');

const targetDbSet = 'public DbSet<SupportTicketMessage> SupportTicketMessages => Set<SupportTicketMessage>();';
const newDbSets = `public DbSet<SupportTicketMessage> SupportTicketMessages => Set<SupportTicketMessage>();
    public DbSet<CarrierRemittanceBatch> CarrierRemittanceBatches => Set<CarrierRemittanceBatch>();`;

if (!dbContext.includes('public DbSet<CarrierRemittanceBatch> CarrierRemittanceBatches')) {
    dbContext = dbContext.replace(targetDbSet, newDbSets);
}

const entityConfig = `
        // --- CarrierRemittanceBatch -----------------------------
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
        });
`;

if (!dbContext.includes('modelBuilder.Entity<CarrierRemittanceBatch>')) {
    const lastClosingIndex = dbContext.lastIndexOf('    }');
    dbContext = dbContext.slice(0, lastClosingIndex) + entityConfig + '\n' + dbContext.slice(lastClosingIndex);
}

fs.writeFileSync(dbContextPath, dbContext, 'utf8');
console.log('Patched AppDbContext.cs for Wave 6');

// 2. IUnitOfWork.cs
const iUowPath = path.join(__dirname, '../../backend/Marketplace.Application/Interfaces/IUnitOfWork.cs');
let iUow = fs.readFileSync(iUowPath, 'utf8');

const targetIUow = 'IRepository<SupportTicketMessage> SupportTicketMessages { get; }';
const newIUow = `IRepository<SupportTicketMessage> SupportTicketMessages { get; }
    IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches { get; }`;

if (!iUow.includes('CarrierRemittanceBatches')) {
    iUow = iUow.replace(targetIUow, newIUow);
    fs.writeFileSync(iUowPath, iUow, 'utf8');
    console.log('Patched IUnitOfWork.cs for Wave 6');
}

// 3. UnitOfWork.cs
const uowPath = path.join(__dirname, '../../backend/Marketplace.Infrastructure/Repositories/UnitOfWork.cs');
let uow = fs.readFileSync(uowPath, 'utf8');

const targetCtor = 'SupportTicketMessages = new Repository<SupportTicketMessage>(context);';
const newCtor = `SupportTicketMessages = new Repository<SupportTicketMessage>(context);
        CarrierRemittanceBatches = new Repository<CarrierRemittanceBatch>(context);`;

const targetProp = 'public IRepository<SupportTicketMessage> SupportTicketMessages { get; }';
const newProp = `public IRepository<SupportTicketMessage> SupportTicketMessages { get; }
    public IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches { get; }`;

if (!uow.includes('CarrierRemittanceBatches')) {
    uow = uow.replace(targetCtor, newCtor);
    uow = uow.replace(targetProp, newProp);
    fs.writeFileSync(uowPath, uow, 'utf8');
    console.log('Patched UnitOfWork.cs for Wave 6');
}

// 4. FileSecurityAndValidationTests.cs
const testFakePath = path.join(__dirname, '../../backend/Marketplace.Tests/FileSecurityAndValidationTests.cs');
let testFake = fs.readFileSync(testFakePath, 'utf8');

const targetFake = 'public IRepository<SupportTicketMessage> SupportTicketMessages => throw new NotImplementedException();';
const newFake = `public IRepository<SupportTicketMessage> SupportTicketMessages => throw new NotImplementedException();
    public IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches => throw new NotImplementedException();`;

if (!testFake.includes('CarrierRemittanceBatches')) {
    testFake = testFake.replace(targetFake, newFake);
    fs.writeFileSync(testFakePath, testFake, 'utf8');
    console.log('Patched FileSecurityAndValidationTests.cs for Wave 6');
}
