using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWave6BulkUploadCarrierRemittancePartialDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AdjustedCodAmount",
                table: "Shipments",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPartiallyDelivered",
                table: "Shipments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "AcceptedQuantity",
                table: "OrderItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RefusedQuantity",
                table: "OrderItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "CarrierRemittanceBatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BatchReference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CarrierName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UploadedByAdminId = table.Column<int>(type: "integer", nullable: false),
                    TotalShipmentsCount = table.Column<int>(type: "integer", nullable: false),
                    MatchedCount = table.Column<int>(type: "integer", nullable: false),
                    MismatchCount = table.Column<int>(type: "integer", nullable: false),
                    ExpectedCodTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ActualRemittedTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CarrierFeesTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetSettledTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscrepanciesJson = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CarrierRemittanceBatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CarrierRemittanceBatches_Users_UploadedByAdminId",
                        column: x => x.UploadedByAdminId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CarrierRemittanceBatches_BatchReference",
                table: "CarrierRemittanceBatches",
                column: "BatchReference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CarrierRemittanceBatches_CreatedAt",
                table: "CarrierRemittanceBatches",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_CarrierRemittanceBatches_UploadedByAdminId",
                table: "CarrierRemittanceBatches",
                column: "UploadedByAdminId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CarrierRemittanceBatches");

            migrationBuilder.DropColumn(
                name: "AdjustedCodAmount",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "IsPartiallyDelivered",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "AcceptedQuantity",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "RefusedQuantity",
                table: "OrderItems");
        }
    }
}
