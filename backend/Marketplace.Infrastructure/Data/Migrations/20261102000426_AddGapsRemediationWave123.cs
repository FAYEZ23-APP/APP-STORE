using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGapsRemediationWave123 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CodRefusalCount",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "AllowInspection",
                table: "Shipments",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Apartment",
                table: "Shipments",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuildingNumber",
                table: "Shipments",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DeliveryLatitude",
                table: "Shipments",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DeliveryLongitude",
                table: "Shipments",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EscrowReleaseAt",
                table: "Shipments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Floor",
                table: "Shipments",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Landmark",
                table: "Shipments",
                type: "character varying(250)",
                maxLength: 250,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "ReturnRequests",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "ReturnRequests",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Standard14Day");

            migrationBuilder.AddColumn<DateTime>(
                name: "ReceivedAt",
                table: "ReturnRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowInspection",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Apartment",
                table: "Orders",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuildingNumber",
                table: "Orders",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmedAt",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DeliveryLatitude",
                table: "Orders",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DeliveryLongitude",
                table: "Orders",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Floor",
                table: "Orders",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsBuyerConfirmed",
                table: "Orders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Landmark",
                table: "Orders",
                type: "character varying(250)",
                maxLength: 250,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CodRefusalCount",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AllowInspection",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "Apartment",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "BuildingNumber",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "DeliveryLatitude",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "DeliveryLongitude",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "EscrowReleaseAt",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "Floor",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "Landmark",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "ReceivedAt",
                table: "ReturnRequests");

            migrationBuilder.DropColumn(
                name: "AllowInspection",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Apartment",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BuildingNumber",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ConfirmedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DeliveryLatitude",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DeliveryLongitude",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Floor",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "IsBuyerConfirmed",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Landmark",
                table: "Orders");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "ReturnRequests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(30)",
                oldMaxLength: 30);
        }
    }
}
