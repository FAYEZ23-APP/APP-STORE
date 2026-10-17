using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProductCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IconName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Categories",
                columns: new[] { "Id", "IconName", "Key" },
                values: new object[,]
                {
                    { 1, "devices", "electronics" },
                    { 2, "shirt", "clothing" },
                    { 3, "shoe-sneaker", "shoes" },
                    { 4, "home", "home" },
                    { 5, "sparkles", "beauty" },
                    { 6, "baby", "kids" },
                    { 7, "basketball", "sports" },
                    { 8, "watch", "accessories" },
                    { 9, "dots-horizontal", "other" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Key",
                table: "Categories",
                column: "Key",
                unique: true);

            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "Products",
                type: "integer",
                nullable: false,
                defaultValue: 9);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Products",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "NOW()");

            migrationBuilder.Sql("UPDATE \"Products\" SET \"CategoryId\" = 9, \"CreatedAt\" = NOW() WHERE \"CategoryId\" = 0 OR \"CategoryId\" IS NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_Products_CategoryId",
                table: "Products",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Categories_CategoryId",
                table: "Products",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_Categories_CategoryId",
                table: "Products");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_Products_CategoryId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Products");
        }
    }
}
