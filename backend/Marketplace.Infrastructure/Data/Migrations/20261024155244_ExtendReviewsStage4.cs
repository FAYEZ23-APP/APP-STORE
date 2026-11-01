using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ExtendReviewsStage4 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Reviews_ProductId_BuyerId",
                table: "Reviews");

            migrationBuilder.AddColumn<DateTime>(
                name: "HiddenAt",
                table: "Reviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HiddenByAdminId",
                table: "Reviews",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageUrls",
                table: "Reviews",
                type: "text",
                nullable: false,
                defaultValueSql: "'[]'");

            migrationBuilder.AddColumn<bool>(
                name: "IsHidden",
                table: "Reviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ModerationNote",
                table: "Reviews",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SellerRepliedAt",
                table: "Reviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SellerReply",
                table: "Reviews",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ReviewReports",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ReviewId = table.Column<int>(type: "integer", nullable: false),
                    ReporterId = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Details = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewReports_Reviews_ReviewId",
                        column: x => x.ReviewId,
                        principalTable: "Reviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ReviewReports_Users_ReporterId",
                        column: x => x.ReporterId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Safely deduplicate any legacy duplicate (ProductId, BuyerId) rows before creating the unique index
            migrationBuilder.Sql(@"
DELETE FROM ""Reviews"" r
USING ""Reviews"" r2
WHERE r.""ProductId"" = r2.""ProductId""
  AND r.""BuyerId"" = r2.""BuyerId""
  AND r.""Id"" < r2.""Id"";
");

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_ProductId_BuyerId",
                table: "Reviews",
                columns: new[] { "ProductId", "BuyerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReviewReports_ReporterId",
                table: "ReviewReports",
                column: "ReporterId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewReports_ReviewId_ReporterId",
                table: "ReviewReports",
                columns: new[] { "ReviewId", "ReporterId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReviewReports");

            migrationBuilder.DropIndex(
                name: "IX_Reviews_ProductId_BuyerId",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "HiddenAt",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "HiddenByAdminId",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "ImageUrls",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "IsHidden",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "ModerationNote",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "SellerRepliedAt",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "SellerReply",
                table: "Reviews");

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_ProductId_BuyerId",
                table: "Reviews",
                columns: new[] { "ProductId", "BuyerId" });
        }
    }
}
