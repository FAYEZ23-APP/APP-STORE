using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTotpReplayProtection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "TwoFactorLastAcceptedStep",
                table: "Users",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TwoFactorLastAcceptedStep",
                table: "Users");
        }
    }
}
