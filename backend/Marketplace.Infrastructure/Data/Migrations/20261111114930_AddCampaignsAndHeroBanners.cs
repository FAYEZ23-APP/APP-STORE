using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCampaignsAndHeroBanners : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "campaigns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TitleAr = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TitleEn = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SubtitleAr = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    SubtitleEn = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CtaAr = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    CtaEn = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    BadgeAr = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    BadgeEn = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ImageUrlMobile = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ImageUrlDesktop = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    TargetUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TextAlignment = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "center"),
                    OverlayOpacity = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: false, defaultValue: 0.35m),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP AT TIME ZONE 'UTC'"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP AT TIME ZONE 'UTC'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_campaigns", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "campaigns",
                columns: new[] { "Id", "BadgeAr", "BadgeEn", "CreatedAt", "CtaAr", "CtaEn", "EndDate", "ImageUrlDesktop", "ImageUrlMobile", "IsActive", "OverlayOpacity", "Priority", "StartDate", "SubtitleAr", "SubtitleEn", "TargetUrl", "TextAlignment", "TitleAr", "TitleEn", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, "الموسم الجديد", "NEW ARRIVALS", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "اكتشف التشكيلة", "EXPLORE COLLECTION", null, "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600&auto=format&fit=crop&q=85", "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&auto=format&fit=crop&q=85", true, 0.35m, 1, null, "تصاميم راقية وخامات مختارة بعناية تعكس تميزك", "Refined silhouettes and modern craftsmanship for every moment", "category:clothing", "center", "مجموعة الموسم الجديد", "NEW SEASON COLLECTION", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 2, "تشكيلة حصرية", "EXCLUSIVE", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "تسوق الإطلالة", "SHOP THE EDIT", null, "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&auto=format&fit=crop&q=85", "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&auto=format&fit=crop&q=85", true, 0.30m, 2, null, "قصات كلاسيكية تمنحك إطلالة متجددة طوال اليوم", "Timeless tailoring and effortless neutral aesthetics", "category:clothing", "center", "أناقة هادئة وبساطة عصرية", "THE QUIET LUXURY EDIT", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 3, "الأكثر طلباً", "TRENDING", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "تصفح العروض", "VIEW CAPSULE", null, "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&auto=format&fit=crop&q=85", "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=85", true, 0.35m, 3, null, "أحدث تصاميم السنيكرز والملابس الرياضية اليومية", "Bold contemporary streetwear and essential statement pieces", "category:shoes", "center", "أزياء الشارع العصرية", "URBAN STREETWEAR CAPSULE", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) }
                });

            migrationBuilder.CreateIndex(
                name: "IX_campaigns_IsActive",
                table: "campaigns",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_campaigns_IsActive_Priority",
                table: "campaigns",
                columns: new[] { "IsActive", "Priority" });

            migrationBuilder.CreateIndex(
                name: "IX_campaigns_Priority",
                table: "campaigns",
                column: "Priority");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "campaigns");
        }
    }
}
