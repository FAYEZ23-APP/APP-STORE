const fs = require('fs');

const file = 'backend/Marketplace.Infrastructure/Data/Migrations/AppDbContextModelSnapshot.cs';
let content = fs.readFileSync(file, 'utf8');

// 1. Update AdminAuditLog FK to Restrict
content = content.replace(
  /b\.HasOne\("Marketplace\.Domain\.Entities\.User", "Admin"\)\s*\.WithMany\("AdminAuditLogs"\)\s*\.HasForeignKey\("AdminId"\)\s*\.OnDelete\(DeleteBehavior\.SetNull\);/,
  'b.HasOne("Marketplace.Domain.Entities.User", "Admin")\r\n                        .WithMany("AdminAuditLogs")\r\n                        .HasForeignKey("AdminId")\r\n                        .OnDelete(DeleteBehavior.Restrict);'
);

// 2. Update Category NameAr & NameEn to IsRequired
content = content.replace(
  /b\.Property<string>\("NameAr"\)\s*\.HasMaxLength\(100\)\s*\.HasColumnType\("character varying\(100\)"\);/,
  'b.Property<string>("NameAr")\r\n                        .IsRequired()\r\n                        .HasMaxLength(100)\r\n                        .HasColumnType("character varying(100)");'
);

content = content.replace(
  /b\.Property<string>\("NameEn"\)\s*\.HasMaxLength\(100\)\s*\.HasColumnType\("character varying\(100\)"\);/,
  'b.Property<string>("NameEn")\r\n                        .IsRequired()\r\n                        .HasMaxLength(100)\r\n                        .HasColumnType("character varying(100)");'
);

fs.writeFileSync(file, content, 'utf8');
console.log('AppDbContextModelSnapshot patched cleanly with UTF-8.');
