using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class MakeOrderIdempotencyIndexUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Pre-existing duplicate (BuyerId, IdempotencyKey) rows would make the unique index fail.
            // Orders are financial records and are NEVER deleted: for each duplicate group the oldest
            // order keeps its key, the later duplicates have their key set to NULL.
            migrationBuilder.Sql(@"
UPDATE ""Orders"" o
SET ""IdempotencyKey"" = NULL
WHERE o.""IdempotencyKey"" IS NOT NULL
  AND o.""IdempotencyKey"" <> ''
  AND EXISTS (
      SELECT 1 FROM ""Orders"" k
      WHERE k.""BuyerId"" = o.""BuyerId""
        AND k.""IdempotencyKey"" = o.""IdempotencyKey""
        AND k.""Id"" < o.""Id"");");
            migrationBuilder.DropIndex(
                name: "IX_Orders_BuyerId_IdempotencyKey",
                table: "Orders");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_BuyerId_IdempotencyKey",
                table: "Orders",
                columns: new[] { "BuyerId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL AND \"IdempotencyKey\" <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_BuyerId_IdempotencyKey",
                table: "Orders");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_BuyerId_IdempotencyKey",
                table: "Orders",
                columns: new[] { "BuyerId", "IdempotencyKey" });
        }
    }
}
