using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEgyptianMarketAndPdpl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ─── 1. UserAddresses table updates ────────────────────────────
            migrationBuilder.RenameColumn(
                name: "AddressLine",
                table: "UserAddresses",
                newName: "StreetBuilding");

            migrationBuilder.AddColumn<string>(
                name: "Area",
                table: "UserAddresses",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "غير محدد");

            migrationBuilder.AddColumn<string>(
                name: "Governorate",
                table: "UserAddresses",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "غير محدد");

            // ─── 2. Orders table updates ───────────────────────────────────
            migrationBuilder.AddColumn<string>(
                name: "Area",
                table: "Orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "غير محدد");

            migrationBuilder.AddColumn<string>(
                name: "Governorate",
                table: "Orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "غير محدد");

            migrationBuilder.AddColumn<string>(
                name: "StreetBuilding",
                table: "Orders",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "غير محدد");

            // ─── 3. Backfill legacy data & drop column defaults ────────────
            migrationBuilder.Sql(@"
-- UserAddresses backfill: map legacy City to Governorate if plausible, use 'غير محدد' for missing
UPDATE ""UserAddresses""
SET ""Governorate"" = COALESCE(NULLIF(TRIM(""City""), ''), 'غير محدد'),
    ""Area"" = 'غير محدد',
    ""StreetBuilding"" = COALESCE(NULLIF(TRIM(""StreetBuilding""), ''), 'غير محدد');

-- Drop defaults so new inserts MUST provide explicit values
ALTER TABLE ""UserAddresses"" ALTER COLUMN ""Governorate"" DROP DEFAULT;
ALTER TABLE ""UserAddresses"" ALTER COLUMN ""Area"" DROP DEFAULT;
ALTER TABLE ""UserAddresses"" ALTER COLUMN ""StreetBuilding"" DROP DEFAULT;

-- Orders backfill: copy AddressLine to StreetBuilding, map City to Governorate
UPDATE ""Orders""
SET ""Governorate"" = COALESCE(NULLIF(TRIM(""City""), ''), 'غير محدد'),
    ""Area"" = 'غير محدد',
    ""StreetBuilding"" = COALESCE(NULLIF(TRIM(""AddressLine""), ''), 'غير محدد');

-- Drop defaults on Orders so new orders MUST provide explicit values
ALTER TABLE ""Orders"" ALTER COLUMN ""Governorate"" DROP DEFAULT;
ALTER TABLE ""Orders"" ALTER COLUMN ""Area"" DROP DEFAULT;
ALTER TABLE ""Orders"" ALTER COLUMN ""StreetBuilding"" DROP DEFAULT;
");

            migrationBuilder.DropColumn(
                name: "AddressLine",
                table: "Orders");

            // ─── 4. Shipments: CodAmount and ReturnReason ──────────────────
            migrationBuilder.AddColumn<decimal>(
                name: "CodAmount",
                table: "Shipments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "ReturnReason",
                table: "Shipments",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            // Backfill CodAmount for existing shipments where order PaymentMethod is OnReceipt or CashOnDelivery
            migrationBuilder.Sql(@"
UPDATE ""Shipments"" s
SET ""CodAmount"" = COALESCE((
    SELECT SUM(oi.""UnitPrice"" * oi.""Quantity"")
    FROM ""OrderItems"" oi
    WHERE oi.""ShipmentId"" = s.""Id""
), 0) + s.""DeliveryCost""
FROM ""Orders"" o
WHERE s.""OrderId"" = o.""Id""
  AND o.""PaymentMethod"" IN ('OnReceipt', 'CashOnDelivery');

-- Drop default on CodAmount
ALTER TABLE ""Shipments"" ALTER COLUMN ""CodAmount"" DROP DEFAULT;
");

            // ─── 5. UserConsents (PDPL 151/2020) with RESTRICT on delete ───
            migrationBuilder.CreateTable(
                name: "UserConsents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    PolicyVersion = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MarketingConsent = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserConsents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserConsents_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserConsents_UserId",
                table: "UserConsents",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserConsents");

            migrationBuilder.DropColumn(
                name: "Area",
                table: "UserAddresses");

            migrationBuilder.DropColumn(
                name: "Governorate",
                table: "UserAddresses");

            migrationBuilder.DropColumn(
                name: "CodAmount",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "ReturnReason",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "Area",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Governorate",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "StreetBuilding",
                table: "Orders");

            migrationBuilder.RenameColumn(
                name: "StreetBuilding",
                table: "UserAddresses",
                newName: "AddressLine");

            migrationBuilder.AddColumn<string>(
                name: "AddressLine",
                table: "Orders",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);
        }
    }
}
