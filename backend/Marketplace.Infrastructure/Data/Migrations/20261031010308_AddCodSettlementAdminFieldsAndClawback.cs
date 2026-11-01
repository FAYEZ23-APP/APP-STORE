using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCodSettlementAdminFieldsAndClawback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FlaggedForReview",
                table: "Shipments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "ReceivedAmount",
                table: "Shipments",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SettledByAdminId",
                table: "Shipments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SettlementReference",
                table: "Shipments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_SettledByAdminId",
                table: "Shipments",
                column: "SettledByAdminId");

            migrationBuilder.AddForeignKey(
                name: "FK_Shipments_Users_SettledByAdminId",
                table: "Shipments",
                column: "SettledByAdminId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Shipments_Users_SettledByAdminId",
                table: "Shipments");

            migrationBuilder.DropIndex(
                name: "IX_Shipments_SettledByAdminId",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "FlaggedForReview",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "ReceivedAmount",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "SettledByAdminId",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "SettlementReference",
                table: "Shipments");
        }
    }
}
