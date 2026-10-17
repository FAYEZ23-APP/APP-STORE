using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProductOldPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "OldPrice",
                table: "Products",
                type: "numeric(18,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OldPrice",
                table: "Products");
        }
    }
}
