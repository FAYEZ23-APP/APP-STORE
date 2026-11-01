using System.Text.Json;
using Npgsql;

// Read-only verification helper. Connection string comes from the PGCHECK_CONN environment
// variable (never printed). Refuses to run unless the database name ends with "_test".
// Only fixed, parameterised SELECT queries are available (no arbitrary SQL).
var conn = Environment.GetEnvironmentVariable("PGCHECK_CONN");
if (string.IsNullOrWhiteSpace(conn)) { Console.Error.WriteLine("PGCHECK_CONN not set"); return 2; }

var csb = new NpgsqlConnectionStringBuilder(conn);
var dbName = csb.Database ?? "";
if (!dbName.EndsWith("_test", StringComparison.Ordinal))
{
    Console.Error.WriteLine($"ABORT: database '{dbName}' does not end with _test");
    return 3;
}

if (args.Length == 0) { Console.Error.WriteLine("usage: index | orders <buyerId> <idemKey> | stock <productId>"); return 2; }

await using var ds = NpgsqlDataSource.Create(csb.ConnectionString);
await using var cmd = ds.CreateCommand();

switch (args[0])
{
    case "index":
        cmd.CommandText = "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Orders' AND indexname = 'IX_Orders_BuyerId_IdempotencyKey'";
        break;
    case "orders":
        cmd.CommandText = "SELECT \"Id\" FROM \"Orders\" WHERE \"BuyerId\" = @b AND \"IdempotencyKey\" = @k ORDER BY \"Id\"";
        cmd.Parameters.AddWithValue("b", int.Parse(args[1]));
        cmd.Parameters.AddWithValue("k", args[2]);
        break;
    case "stock":
        cmd.CommandText = "SELECT \"Stock\" FROM \"Products\" WHERE \"Id\" = @p";
        cmd.Parameters.AddWithValue("p", int.Parse(args[1]));
        break;
    case "user-phone":
        cmd.CommandText = "SELECT \"Phone\" FROM \"Users\" WHERE \"Id\" = @u";
        cmd.Parameters.AddWithValue("u", int.Parse(args[1]));
        break;
    case "user-by-phone":
        cmd.CommandText = "SELECT \"Id\", \"Phone\" FROM \"Users\" WHERE \"Phone\" = @p";
        cmd.Parameters.AddWithValue("p", args[1]);
        break;
    case "order-phone":
        cmd.CommandText = "SELECT \"RecipientPhone\" FROM \"Orders\" WHERE \"Id\" = @o";
        cmd.Parameters.AddWithValue("o", int.Parse(args[1]));
        break;
    case "buyer-wallet":
        cmd.CommandText = "SELECT \"Balance\" FROM \"BuyerWallets\" WHERE \"BuyerId\" = @b";
        cmd.Parameters.AddWithValue("b", int.Parse(args[1]));
        break;
    case "buyer-wallet-refund":
        cmd.CommandText = "SELECT \"Amount\" FROM \"BuyerWalletTransactions\" WHERE \"BuyerId\" = @b AND \"OrderId\" = @o AND \"Type\" = 'RefundCredit'";
        cmd.Parameters.AddWithValue("b", int.Parse(args[1]));
        cmd.Parameters.AddWithValue("o", int.Parse(args[2]));
        break;
    case "variant-stock":
        cmd.CommandText = "SELECT \"Stock\" FROM \"ProductVariants\" WHERE \"Id\" = @v";
        cmd.Parameters.AddWithValue("v", int.Parse(args[1]));
        break;
    case "set-shipment-cod-amount":
        {
            var sId = int.Parse(args[1]);
            var amt = decimal.Parse(args[2]);
            cmd.CommandText = "UPDATE \"Shipments\" SET \"CodAmount\" = @amt WHERE \"Id\" = @s";
            cmd.Parameters.AddWithValue("s", sId);
            cmd.Parameters.AddWithValue("amt", amt);
            var aff = await cmd.ExecuteNonQueryAsync();
            Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, updated = true, rows = aff }));
            return 0;
        }
    case "delete-escrow-hold-tx":
        {
            var sId = int.Parse(args[1]);
            cmd.CommandText = "DELETE FROM \"WalletTransactions\" WHERE \"ShipmentId\" = @s AND \"Type\" = 'COD_EscrowHold'";
            cmd.Parameters.AddWithValue("s", sId);
            var aff = await cmd.ExecuteNonQueryAsync();
            Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, deleted = true, rows = aff }));
            return 0;
        }
    case "credit-buyer-wallet":
        {
            var bId = int.Parse(args[1]);
            var amt = decimal.Parse(args[2]);
            cmd.CommandText = @"
                INSERT INTO ""BuyerWallets"" (""BuyerId"", ""Balance"", ""UpdatedAt"")
                VALUES (@b, @amt, @now)
                ON CONFLICT (""BuyerId"") DO UPDATE
                SET ""Balance"" = ""BuyerWallets"".""Balance"" + @amt, ""UpdatedAt"" = @now";
            cmd.Parameters.AddWithValue("b", bId);
            cmd.Parameters.AddWithValue("amt", amt);
            cmd.Parameters.AddWithValue("now", DateTime.UtcNow);
            await cmd.ExecuteNonQueryAsync();
            Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, credited = true, amount = amt }));
            return 0;
        }
    case "verification-target":
        cmd.CommandText = "SELECT \"Target\" FROM \"VerificationCodes\" WHERE \"Target\" = @t ORDER BY \"CreatedAt\" DESC LIMIT 1";
        cmd.Parameters.AddWithValue("t", args[1]);
        break;
    case "apply-idempotency-migration":
        // Writes ONLY to a *_test database (guard above). Applies the generated script of migration
        // 20261030011003_MakeOrderIdempotencyIndexUnique when the index is not yet unique.
        // Needed because the _test schema was created out-of-band, so MigrateAsync stops at an earlier migration.
        {
            var sqlPath = Path.GetFullPath(args[1]);
            if (!sqlPath.EndsWith("20261030011003_MakeOrderIdempotencyIndexUnique.sql", StringComparison.Ordinal) || !File.Exists(sqlPath))
            { Console.Error.WriteLine("ABORT: only the Problem #3 migration script is allowed"); return 4; }
            await using var chk = ds.CreateCommand("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Orders' AND indexname = 'IX_Orders_BuyerId_IdempotencyKey'");
            var cur = (string?)await chk.ExecuteScalarAsync() ?? "";
            if (cur.StartsWith("CREATE UNIQUE INDEX", StringComparison.Ordinal))
            { Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, applied = false, reason = "already unique" })); return 0; }
            await using var apply = ds.CreateCommand(File.ReadAllText(sqlPath));
            await apply.ExecuteNonQueryAsync();
            Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, applied = true }));
            return 0;
        }
    case "apply-2fa-migration":
        // Writes ONLY to a *_test database (guard above). Applies the generated script of migration
        // 20261030_AddAdminTwoFactorAuth.sql when columns do not exist yet.
        {
            var sqlPath = Path.GetFullPath(args[1]);
            if (!sqlPath.EndsWith("20261030_AddAdminTwoFactorAuth.sql", StringComparison.Ordinal) || !File.Exists(sqlPath))
            { Console.Error.WriteLine("ABORT: only the 2FA migration script is allowed"); return 4; }
            await using var chk = ds.CreateCommand("SELECT column_name FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'IsTwoFactorEnabled'");
            var cur = (string?)await chk.ExecuteScalarAsync();
            if (!string.IsNullOrEmpty(cur))
            { Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, applied = false, reason = "already applied" })); return 0; }
            await using var apply = ds.CreateCommand(File.ReadAllText(sqlPath));
            await apply.ExecuteNonQueryAsync();
            Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, applied = true }));
            return 0;
        }
    case "reset-admin-2fa":
        // Safely resets 2FA columns for the test admin user in *_test DB to ensure test reproducibility
        {
            var email = args[1].ToLowerInvariant();
            await using var upd = ds.CreateCommand("UPDATE \"Users\" SET \"IsTwoFactorEnabled\" = FALSE, \"TwoFactorSecret\" = NULL WHERE LOWER(\"Email\") = @e");
            upd.Parameters.AddWithValue("e", email);
            var aff = await upd.ExecuteNonQueryAsync();
            Console.WriteLine(JsonSerializer.Serialize(new { email, reset = true, rows = aff }));
            return 0;
        }
    case "apply-cod-escrow-migration":
        // Writes ONLY to a *_test database (guard above). Applies the generated script of migration
        // 20261030_AddCodEscrowHoldToShipments.sql when columns do not exist yet.
        {
            var sqlPath = Path.GetFullPath(args[1]);
            if (!sqlPath.EndsWith("20261030_AddCodEscrowHoldToShipments.sql", StringComparison.Ordinal) || !File.Exists(sqlPath))
            { Console.Error.WriteLine("ABORT: only the COD escrow migration script is allowed"); return 4; }
            await using var chk = ds.CreateCommand("SELECT column_name FROM information_schema.columns WHERE table_name = 'Shipments' AND column_name = 'IsCodSettled'");
            var cur = (string?)await chk.ExecuteScalarAsync();
            if (!string.IsNullOrEmpty(cur))
            { Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, applied = false, reason = "already applied" })); return 0; }
            await using var apply = ds.CreateCommand(File.ReadAllText(sqlPath));
            await apply.ExecuteNonQueryAsync();
            Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, applied = true }));
            return 0;
        }
    case "apply-cod-settlement-fields-migration":
        // Writes ONLY to a *_test database (guard above). Applies the generated script of migration
        // 20261031_AddCodSettlementAdminFieldsAndClawback.sql when columns do not exist yet.
        {
            var sqlPath = Path.GetFullPath(args[1]);
            if (!sqlPath.EndsWith("20261031_AddCodSettlementAdminFieldsAndClawback.sql", StringComparison.Ordinal) || !File.Exists(sqlPath))
            { Console.Error.WriteLine("ABORT: only the COD settlement fields migration script is allowed"); return 4; }
            await using var chk = ds.CreateCommand("SELECT column_name FROM information_schema.columns WHERE table_name = 'Shipments' AND column_name = 'SettlementReference'");
            var cur = (string?)await chk.ExecuteScalarAsync();
            if (!string.IsNullOrEmpty(cur))
            { Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, applied = false, reason = "already applied" })); return 0; }
            await using var apply = ds.CreateCommand(File.ReadAllText(sqlPath));
            await apply.ExecuteNonQueryAsync();
            Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, applied = true }));
            return 0;
        }
    default:
        Console.Error.WriteLine("unknown command"); return 2;
}

var rows = new List<object?>();
await using (var r = await cmd.ExecuteReaderAsync())
{
    while (await r.ReadAsync()) rows.Add(r.IsDBNull(0) ? null : r.GetValue(0));
}
Console.WriteLine(JsonSerializer.Serialize(new { database = dbName, rows }));
return 0;
