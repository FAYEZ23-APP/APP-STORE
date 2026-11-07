using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class Phase4RefreshTokenFamilies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConsumedAt",
                table: "RefreshTokens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FamilyId",
                table: "RefreshTokens",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "RevokeReason",
                table: "RefreshTokens",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            // Backfill (non-destructive): no session is revoked. Existing tokens are grouped into one family per (UserId, DeviceId),
            // matching the previous per-device reuse semantics; already-rotated tokens are marked consumed so replay detection covers them.
            migrationBuilder.Sql(@"
                UPDATE ""RefreshTokens"" r
                SET ""FamilyId"" = g.fid
                FROM (
                    SELECT d.""UserId"", d.""DeviceId"", gen_random_uuid() AS fid
                    FROM (SELECT DISTINCT ""UserId"", ""DeviceId"" FROM ""RefreshTokens"") d
                ) g
                WHERE r.""UserId"" = g.""UserId"" AND r.""DeviceId"" = g.""DeviceId"";

                UPDATE ""RefreshTokens""
                SET ""ConsumedAt"" = ""RevokedAt"", ""RevokeReason"" = COALESCE(""RevokeReason"", 'Rotated')
                WHERE ""ReplacedByTokenId"" IS NOT NULL AND ""RevokedAt"" IS NOT NULL AND ""ConsumedAt"" IS NULL;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_FamilyId",
                table: "RefreshTokens",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_RevokedAt",
                table: "RefreshTokens",
                column: "RevokedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_FamilyId",
                table: "RefreshTokens");

            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_RevokedAt",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "ConsumedAt",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "FamilyId",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "RevokeReason",
                table: "RefreshTokens");
        }
    }
}
