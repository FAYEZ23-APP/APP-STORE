using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RepairOrderItemsAcceptedAndRefusedQuantities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'OrderItems' 
          AND column_name = 'AcceptedQuantity'
    ) THEN
        ALTER TABLE ""OrderItems"" ADD COLUMN ""AcceptedQuantity"" integer NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'OrderItems' 
          AND column_name = 'RefusedQuantity'
    ) THEN
        ALTER TABLE ""OrderItems"" ADD COLUMN ""RefusedQuantity"" integer NOT NULL DEFAULT 0;
    END IF;
END $$;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
    -- Safeguard: Prevent accidental loss of AcceptedQuantity and RefusedQuantity data
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'OrderItems' AND column_name = 'AcceptedQuantity'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'OrderItems'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM ""OrderItems"" WHERE ""AcceptedQuantity"" > 0 OR ""RefusedQuantity"" > 0
        ) THEN
            RAISE EXCEPTION 'Cannot roll back RepairOrderItemsAcceptedAndRefusedQuantities: OrderItems table contains recorded partial delivery data.';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'OrderItems' 
          AND column_name = 'RefusedQuantity'
    ) THEN
        ALTER TABLE ""OrderItems"" DROP COLUMN ""RefusedQuantity"";
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'OrderItems' 
          AND column_name = 'AcceptedQuantity'
    ) THEN
        ALTER TABLE ""OrderItems"" DROP COLUMN ""AcceptedQuantity"";
    END IF;
END $$;
");
        }
    }
}
