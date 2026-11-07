const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../backend/Marketplace.Infrastructure/Data/AppDbContext.cs');
let content = fs.readFileSync(filePath, 'utf8');

const anchor = 'modelBuilder.Entity<AdminAuditLog>(entity =>';
const insertBlock = `        // --- CodBlacklistEntry ------------------------------------
        modelBuilder.Entity<CodBlacklistEntry>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.PhoneNormalized)
                .IsRequired()
                .HasMaxLength(30);

            entity.Property(e => e.Reason)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(e => e.RefusalCount)
                .IsRequired()
                .HasDefaultValue(0);

            entity.Property(e => e.RiskScore)
                .IsRequired()
                .HasDefaultValue(0);

            entity.Property(e => e.IsBlocked)
                .IsRequired()
                .HasDefaultValue(false);

            entity.Property(e => e.CreatedAt)
                .IsRequired();

            entity.HasIndex(e => e.PhoneNormalized)
                .HasDatabaseName("IX_CodBlacklistEntries_PhoneNormalized");

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.CreatedByAdmin)
                .WithMany()
                .HasForeignKey(e => e.CreatedByAdminId)
                .OnDelete(DeleteBehavior.SetNull);
        });

`;

const isCrlf = content.includes('\r\n');
const lineEnding = isCrlf ? '\r\n' : '\n';

// Find the closing brace of AdminAuditLog entity block
const adminIndex = content.indexOf(anchor);
if (adminIndex === -1) {
    throw new Error('AdminAuditLog block not found');
}
const closingBraceIndex = content.indexOf('        });', adminIndex);
if (closingBraceIndex === -1) {
    throw new Error('Closing brace for AdminAuditLog not found');
}

const endOfBlock = closingBraceIndex + '        });'.length;
const newContent = content.slice(0, endOfBlock) + lineEnding + lineEnding +
    (isCrlf ? insertBlock.replace(/\n/g, '\r\n') : insertBlock) +
    content.slice(endOfBlock);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('AppDbContext.cs successfully patched with CodBlacklistEntry configuration.');
