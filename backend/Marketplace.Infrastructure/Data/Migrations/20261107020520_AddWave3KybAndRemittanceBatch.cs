using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWave3KybAndRemittanceBatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RemittanceBatchReference",
                table: "Shipments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CommercialRegisterNumber",
                table: "SellerProfiles",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "KybDocumentUrl",
                table: "SellerProfiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "KybRejectionReason",
                table: "SellerProfiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "KybStatus",
                table: "SellerProfiles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Unverified");

            migrationBuilder.AddColumn<DateTime>(
                name: "KybVerifiedAt",
                table: "SellerProfiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NationalIdNumber",
                table: "SellerProfiles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaxCardNumber",
                table: "SellerProfiles",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RemittanceBatchReference",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "CommercialRegisterNumber",
                table: "SellerProfiles");

            migrationBuilder.DropColumn(
                name: "KybDocumentUrl",
                table: "SellerProfiles");

            migrationBuilder.DropColumn(
                name: "KybRejectionReason",
                table: "SellerProfiles");

            migrationBuilder.DropColumn(
                name: "KybStatus",
                table: "SellerProfiles");

            migrationBuilder.DropColumn(
                name: "KybVerifiedAt",
                table: "SellerProfiles");

            migrationBuilder.DropColumn(
                name: "NationalIdNumber",
                table: "SellerProfiles");

            migrationBuilder.DropColumn(
                name: "TaxCardNumber",
                table: "SellerProfiles");
        }
    }
}
