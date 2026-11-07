using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWave2ReturnDisputeAndReverseLogistics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DisputeEvidenceUrlsJson",
                table: "ReturnRequests",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisputeReason",
                table: "ReturnRequests",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisputeResolutionNotes",
                table: "ReturnRequests",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DisputeResolvedByAdminId",
                table: "ReturnRequests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DisputedAt",
                table: "ReturnRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDisputed",
                table: "ReturnRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsItemReceivedBySeller",
                table: "ReturnRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ItemReceivedAt",
                table: "ReturnRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReverseTrackingNumber",
                table: "ReturnRequests",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReturnRequests_DisputeResolvedByAdminId",
                table: "ReturnRequests",
                column: "DisputeResolvedByAdminId");

            migrationBuilder.AddForeignKey(
                name: "FK_ReturnRequests_Users_DisputeResolvedByAdminId",
                table: "ReturnRequests",
                column: "DisputeResolvedByAdminId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ReturnRequests_Users_DisputeResolvedByAdminId",
                table: "ReturnRequests");

            migrationBuilder.DropIndex(
                name: "IX_ReturnRequests_DisputeResolvedByAdminId",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "DisputeEvidenceUrlsJson",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "DisputeReason",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "DisputeResolutionNotes",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "DisputeResolvedByAdminId",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "DisputedAt",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "IsDisputed",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "IsItemReceivedBySeller",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "ItemReceivedAt",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "ReverseTrackingNumber",
                table: "ReturnRequests");
        }
    }
}
