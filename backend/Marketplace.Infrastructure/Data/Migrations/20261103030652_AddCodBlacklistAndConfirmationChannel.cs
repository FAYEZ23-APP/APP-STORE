using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCodBlacklistAndConfirmationChannel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "UploadedFiles",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "ProductImage");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "UploadedFiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "UploadedFiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsLegalHold",
                table: "UploadedFiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPrivate",
                table: "UploadedFiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "RetentionExpiresAt",
                table: "UploadedFiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConfirmationChannel",
                table: "Orders",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CodBlacklistEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PhoneNormalized = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    RefusalCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    RiskScore = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    IsBlocked = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByAdminId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CodBlacklistEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CodBlacklistEntries_Users_CreatedByAdminId",
                        column: x => x.CreatedByAdminId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CodBlacklistEntries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UploadedFiles_Category",
                table: "UploadedFiles",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_UploadedFiles_IsDeleted",
                table: "UploadedFiles",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_CodBlacklistEntries_CreatedByAdminId",
                table: "CodBlacklistEntries",
                column: "CreatedByAdminId");

            migrationBuilder.CreateIndex(
                name: "IX_CodBlacklistEntries_PhoneNormalized",
                table: "CodBlacklistEntries",
                column: "PhoneNormalized");

            migrationBuilder.CreateIndex(
                name: "IX_CodBlacklistEntries_UserId",
                table: "CodBlacklistEntries",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CodBlacklistEntries");

            migrationBuilder.DropIndex(
                name: "IX_UploadedFiles_Category",
                table: "UploadedFiles");

            migrationBuilder.DropIndex(
                name: "IX_UploadedFiles_IsDeleted",
                table: "UploadedFiles");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "UploadedFiles");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "UploadedFiles");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "UploadedFiles");

            migrationBuilder.DropColumn(
                name: "IsLegalHold",
                table: "UploadedFiles");

            migrationBuilder.DropColumn(
                name: "IsPrivate",
                table: "UploadedFiles");

            migrationBuilder.DropColumn(
                name: "RetentionExpiresAt",
                table: "UploadedFiles");

            migrationBuilder.DropColumn(
                name: "ConfirmationChannel",
                table: "Orders");
        }
    }
}
