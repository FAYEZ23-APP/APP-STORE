using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDbAuditWave1ConstraintsAndIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Proactive data cleansing before adding CHECK constraints
            migrationBuilder.Sql(@"
UPDATE ""VendorWallets"" SET ""Balance"" = 0 WHERE ""Balance"" < 0;
UPDATE ""VendorWallets"" SET ""PendingBalance"" = 0 WHERE ""PendingBalance"" < 0;
UPDATE ""BuyerWallets"" SET ""Balance"" = 0 WHERE ""Balance"" < 0;
UPDATE ""Products"" SET ""Stock"" = 0 WHERE ""Stock"" < 0;
UPDATE ""Products"" SET ""Price"" = 0 WHERE ""Price"" < 0;
UPDATE ""ProductVariants"" SET ""Stock"" = 0 WHERE ""Stock"" < 0;
UPDATE ""OrderItems"" SET ""Quantity"" = 1 WHERE ""Quantity"" <= 0;
UPDATE ""OrderItems"" SET ""UnitPrice"" = 0 WHERE ""UnitPrice"" < 0;
UPDATE ""PayoutRequests"" SET ""Amount"" = 1 WHERE ""Amount"" <= 0;

-- Deduplicate default user addresses before adding partial unique index
WITH ranked AS (
  SELECT ""Id"", ""UserId"", ROW_NUMBER() OVER(PARTITION BY ""UserId"" ORDER BY ""CreatedAt"" DESC, ""Id"" DESC) as rn
  FROM ""UserAddresses""
  WHERE ""IsDefault"" = TRUE
)
UPDATE ""UserAddresses""
SET ""IsDefault"" = FALSE
WHERE ""Id"" IN (SELECT ""Id"" FROM ranked WHERE rn > 1);

-- Fix migration drift #17 (DB-005): unify migration history ID and align FK to RESTRICT
DO $$
BEGIN
    UPDATE ""__EFMigrationsHistory"" 
    SET ""MigrationId"" = '20261028024709_AddAdminAuditLogsAndCategoryBilingualNames' 
    WHERE ""MigrationId"" = '20261028015637_AddAdminAuditLogsAndCategoryBilingualNames';

    IF to_regclass('""AdminAuditLogs""') IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'FK_AdminAuditLogs_Users_AdminId' 
              AND conrelid = to_regclass('""AdminAuditLogs""') 
              AND confdeltype != 'r'
        ) THEN
            ALTER TABLE ""AdminAuditLogs"" DROP CONSTRAINT ""FK_AdminAuditLogs_Users_AdminId"";
            ALTER TABLE ""AdminAuditLogs"" ADD CONSTRAINT ""FK_AdminAuditLogs_Users_AdminId"" 
                FOREIGN KEY (""AdminId"") REFERENCES ""Users"" (""Id"") ON DELETE RESTRICT;
        END IF;
    END IF;
END $$;
");

            migrationBuilder.DropIndex(
                name: "IX_UserAddresses_UserId",
                table: "UserAddresses");

            migrationBuilder.DropIndex(
                name: "IX_Products_SearchVector",
                table: "Products");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,");

            migrationBuilder.AddCheckConstraint(
                name: "CK_VendorWallets_Balances_NonNegative",
                table: "VendorWallets",
                sql: "\"Balance\" >= 0 AND \"PendingBalance\" >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_UserAddresses_UserId_SingleDefault",
                table: "UserAddresses",
                column: "UserId",
                unique: true,
                filter: "\"IsDefault\" = TRUE");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ProductVariants_Stock_And_Price_NonNegative",
                table: "ProductVariants",
                sql: "\"Stock\" >= 0 AND (\"PriceOverride\" IS NULL OR \"PriceOverride\" >= 0)");

            migrationBuilder.CreateIndex(
                name: "IX_Products_SearchVector_GinTrgm",
                table: "Products",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Products_Stock_And_Price_NonNegative",
                table: "Products",
                sql: "\"Stock\" >= 0 AND \"Price\" >= 0 AND (\"OldPrice\" IS NULL OR \"OldPrice\" >= 0)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PayoutRequests_Amount_Positive",
                table: "PayoutRequests",
                sql: "\"Amount\" > 0");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_BuyerId_CreatedAt",
                table: "Orders",
                columns: new[] { "BuyerId", "CreatedAt" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_OrderItems_Quantity_And_Price_Valid",
                table: "OrderItems",
                sql: "\"Quantity\" > 0 AND \"UnitPrice\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_BuyerWallets_Balance_NonNegative",
                table: "BuyerWallets",
                sql: "\"Balance\" >= 0");

            // Case-insensitive lower email unique index (DB-008)
            migrationBuilder.Sql(@"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Users_Email_Lower"" ON ""Users"" (lower(""Email"")) WHERE ""Email"" IS NOT NULL AND ""Email"" <> '';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("Downgrade is disabled for audit safety.");
        }
    }
}
