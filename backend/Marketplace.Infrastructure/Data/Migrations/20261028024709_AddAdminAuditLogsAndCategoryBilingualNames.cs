using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminAuditLogsAndCategoryBilingualNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Deterministic backfill of Category bilingual names before enforcing NOT NULL
            migrationBuilder.Sql(@"
UPDATE ""Categories"" SET ""NameAr"" = 'إلكترونيات', ""NameEn"" = 'Electronics' WHERE ""Key"" = 'electronics';
UPDATE ""Categories"" SET ""NameAr"" = 'ملابس وأزياء', ""NameEn"" = 'Clothing & Fashion' WHERE ""Key"" = 'clothing';
UPDATE ""Categories"" SET ""NameAr"" = 'أحذية', ""NameEn"" = 'Shoes' WHERE ""Key"" = 'shoes';
UPDATE ""Categories"" SET ""NameAr"" = 'المنزل والمطبخ', ""NameEn"" = 'Home & Kitchen' WHERE ""Key"" = 'home';
UPDATE ""Categories"" SET ""NameAr"" = 'الصحة والجمال', ""NameEn"" = 'Health & Beauty' WHERE ""Key"" = 'beauty';
UPDATE ""Categories"" SET ""NameAr"" = 'مستلزمات أطفال', ""NameEn"" = 'Kids & Baby' WHERE ""Key"" = 'kids';
UPDATE ""Categories"" SET ""NameAr"" = 'أدوات رياضية', ""NameEn"" = 'Sports & Fitness' WHERE ""Key"" = 'sports';
UPDATE ""Categories"" SET ""NameAr"" = 'ساعات وإكسسوارات', ""NameEn"" = 'Watches & Accessories' WHERE ""Key"" = 'accessories';
UPDATE ""Categories"" SET ""NameAr"" = 'منتجات أخرى', ""NameEn"" = 'Other Products' WHERE ""Key"" = 'other';
UPDATE ""Categories"" SET ""NameAr"" = ""Key"" WHERE ""NameAr"" IS NULL OR ""NameAr"" = '';
UPDATE ""Categories"" SET ""NameEn"" = ""Key"" WHERE ""NameEn"" IS NULL OR ""NameEn"" = '';
");

            migrationBuilder.AlterColumn<string>(
                name: "NameEn",
                table: "Categories",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "NameAr",
                table: "Categories",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "AdminAuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AdminId = table.Column<int>(type: "integer", nullable: true),
                    Action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Details = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminAuditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdminAuditLogs_Users_AdminId",
                        column: x => x.AdminId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditLogs_AdminId",
                table: "AdminAuditLogs",
                column: "AdminId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditLogs_EntityType_CreatedAt",
                table: "AdminAuditLogs",
                columns: new[] { "EntityType", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminAuditLogs");

            migrationBuilder.AlterColumn<string>(
                name: "NameEn",
                table: "Categories",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "NameAr",
                table: "Categories",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);
        }
    }
}
