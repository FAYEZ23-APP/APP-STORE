using System.Net;
using System.Text.Json;
using Marketplace.API.Middleware;
using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.DTOs.Notifications;
using Marketplace.Application.DTOs.Orders;
using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.DTOs.Wallet;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Application.Services;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Marketplace.Infrastructure.Data;
using Marketplace.Infrastructure.Delivery;
using Marketplace.Infrastructure.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using Xunit;

namespace Marketplace.Tests;

/// <summary>
/// Stage 2 Dedicated Regression Tests for COD Order Creation, Seller Shipment Retrieval,
/// Wave 6 Partial Delivery Calculations, Idempotency, Transaction Atomicity,
/// Forward-Only Migration Verification, and Middleware Response Logging.
/// Runs strictly against PostgreSQL TEST_DB (MarketplaceMVP_test).
/// </summary>
public class Wave6OrderShipmentRegressionPgTests
{
    private sealed class NoopNotificationService : INotificationService
    {
        public Task RegisterDeviceTokenAsync(int userId, RegisterDeviceTokenRequest request) => Task.CompletedTask;
        public Task<bool> UnregisterDeviceTokenAsync(int userId, string deviceToken) => Task.FromResult(true);
        public Task<int> PurgeOldReadNotificationsAsync(int retentionDays = 90) => Task.FromResult(0);
        public Task NotifyOrderPlacedAsync(int orderId) => Task.CompletedTask;
        public Task NotifyShipmentStatusChangedAsync(int shipmentId, ShipmentStatus status) => Task.CompletedTask;
        public Task NotifyReturnResolvedAsync(int returnId, ReturnStatus status) => Task.CompletedTask;
        public Task NotifyPayoutProcessedAsync(int payoutId, PayoutStatus status) => Task.CompletedTask;
        public Task<NotificationsListResponse> GetUserNotificationsAsync(int userId, int page = 1, int pageSize = 30)
            => Task.FromResult(new NotificationsListResponse { Items = new List<UserNotificationResponse>(), Page = 1, PageSize = 30, TotalCount = 0 });
        public Task<bool> MarkAsReadAsync(int userId, int notificationId) => Task.FromResult(true);
        public Task<int> MarkAllAsReadAsync(int userId) => Task.FromResult(0);
        public Task<int> GetUnreadCountAsync(int userId) => Task.FromResult(0);
        public Task CreateNotificationAsync(int userId, string titleAr, string titleEn, string bodyAr, string bodyEn, string type, string? referenceId = null) => Task.CompletedTask;
    }

    private sealed class NoopWalletService : IWalletService
    {
        public Task<VendorWalletResponse> GetSellerWalletAsync(int sellerId) => Task.FromResult(new VendorWalletResponse());
        public Task<BuyerWalletResponse> GetBuyerWalletAsync(int buyerId) => Task.FromResult(new BuyerWalletResponse());
        public Task<PayoutRequestResponse> RequestPayoutAsync(int sellerId, CreatePayoutRequest request) => Task.FromResult(new PayoutRequestResponse());
        public Task<IEnumerable<PayoutRequestResponse>> GetSellerPayoutRequestsAsync(int sellerId) => Task.FromResult(Enumerable.Empty<PayoutRequestResponse>());
        public Task<IEnumerable<PayoutRequestResponse>> GetAllPayoutRequestsAsync(string? status = null) => Task.FromResult(Enumerable.Empty<PayoutRequestResponse>());
        public Task<PayoutRequestResponse> ProcessPayoutAsync(int payoutRequestId, ProcessPayoutRequest request) => Task.FromResult(new PayoutRequestResponse());
        public Task ProcessShipmentDeliveredAsync(int shipmentId) => Task.CompletedTask;
        public Task SettleCodShipmentAsync(int shipmentId, string? notes = null) => Task.CompletedTask;
        public Task<SettleCodResultResponse> SettleCodByAdminAsync(int shipmentId, int adminId, AdminSettleCodRequest request) => Task.FromResult(new SettleCodResultResponse());
    }

    private static IConfiguration BuildConfig() =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Features:EnableWallet"] = "false",
            ["Features:EnableVendorPayouts"] = "false",
            ["Features:EnableCoupons"] = "false",
            ["Features:EnableOnlinePayments"] = "false",
            ["Auth:RequireVerification"] = "false",
            ["Orders:MaxCodRefusals"] = "3"
        }).Build();

    private static (OrderService orderService, ShipmentService shipmentService, AppDbContext db) CreateServices()
    {
        var db = PgTestDb.CreateContext();
        db.AssertSafeForDestructiveOperations();
        var uow = new UnitOfWork(db);
        var deliveryProvider = new FakeDeliveryProvider();
        var notifications = new NoopNotificationService();
        var wallet = new NoopWalletService();
        var cfg = BuildConfig();

        var orderService = new OrderService(uow, deliveryProvider, cfg, notifications);
        var shipmentService = new ShipmentService(uow, deliveryProvider, wallet, notifications, cfg);
        return (orderService, shipmentService, db);
    }

    private static async Task<(User buyer, User seller, Product product)> SeedBuyerSellerProductAsync(AppDbContext db, int initialStock = 10, decimal price = 150m)
    {
        var tag = Guid.NewGuid().ToString("N")[..8];

        var buyer = new User
        {
            Email = $"buyer_{tag}@test.eg",
            Phone = $"010{Random.Shared.Next(10000000, 99999999)}",
            Name = $"Buyer {tag}",
            Role = UserRole.Buyer,
            PasswordHash = "hash",
            EmailVerifiedAt = DateTime.UtcNow,
            PhoneVerifiedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(buyer);

        var seller = new User
        {
            Email = $"seller_{tag}@test.eg",
            Phone = $"011{Random.Shared.Next(10000000, 99999999)}",
            Name = $"Seller {tag}",
            Role = UserRole.Seller,
            PasswordHash = "hash",
            EmailVerifiedAt = DateTime.UtcNow,
            PhoneVerifiedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(seller);
        await db.SaveChangesAsync();

        var sellerProfile = new SellerProfile
        {
            UserId = seller.Id,
            DispatchCity = "الجيزة",
            DispatchAddress = "شارع التحرير، الدقي، الجيزة",
            ContactPhone = seller.Phone,
            KybStatus = "Verified"
        };
        db.SellerProfiles.Add(sellerProfile);

        // Find or create category
        var category = await db.Categories.FirstOrDefaultAsync();
        if (category == null)
        {
            category = new Category
            {
                Key = $"cat_{tag}",
                IconName = "tag",
                NameAr = "عام",
                NameEn = "General",
                IsActive = true
            };
            db.Categories.Add(category);
            await db.SaveChangesAsync();
        }

        var product = new Product
        {
            SellerId = seller.Id,
            CategoryId = category.Id,
            Name = $"Test Product {tag}",
            Description = "Description for test product",
            Price = price,
            Stock = initialStock,
            WeightGrams = 500,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow
        };
        db.Products.Add(product);
        await db.SaveChangesAsync();

        return (buyer, seller, product);
    }

    [PgFact]
    public async Task Test01_CodOrderCreation_Succeeds_AndPersistsWave6Columns()
    {
        var (orderService, _, db) = CreateServices();
        var (buyer, seller, product) = await SeedBuyerSellerProductAsync(db, initialStock: 10, price: 200m);

        var request = new CreateOrderRequest
        {
            DeliveryMethod = "Courier",
            PaymentMethod = "OnReceipt",
            RecipientName = buyer.Name,
            RecipientPhone = buyer.Phone,
            Governorate = "القاهرة",
            City = "القاهرة",
            Area = "مدينة نصر",
            StreetBuilding = "شارع عباس العقاد",
            PickupPointId = null,
            IdempotencyKey = Guid.NewGuid().ToString("N"),
            Items = new List<OrderItemRequest>
            {
                new() { ProductId = product.Id, Quantity = 1 }
            }
        };

        // Act
        var orderResponse = await orderService.CreateOrderAsync(buyer.Id, request);

        // Assert
        Assert.NotNull(orderResponse);
        Assert.True(orderResponse.Id > 0);
        Assert.Equal("Pending", orderResponse.Status);

        // Verify in DB
        await using var verifyDb = PgTestDb.CreateContext();
        var order = await verifyDb.Orders
            .Include(o => o.Items)
            .Include(o => o.Shipments)
            .FirstOrDefaultAsync(o => o.Id == orderResponse.Id);

        Assert.NotNull(order);
        Assert.Single(order.Items);
        Assert.Single(order.Shipments);

        var item = order.Items.First();
        Assert.Equal(product.Id, item.ProductId);
        Assert.Equal(1, item.Quantity);
        Assert.Equal(200m, item.UnitPrice);
        Assert.Equal(0, item.AcceptedQuantity);
        Assert.Equal(0, item.RefusedQuantity);

        var shipment = order.Shipments.First();
        Assert.Equal(seller.Id, shipment.SellerId);
        Assert.Equal(item.ShipmentId, shipment.Id);
        Assert.True(shipment.DeliveryCost >= 0);
        Assert.Equal(order.TotalAmount, shipment.CodAmount);
        Assert.Equal(ShipmentStatus.Created, shipment.Status);

        // Stock deduction check (from 10 to 9)
        var updatedProduct = await verifyDb.Products.FirstOrDefaultAsync(p => p.Id == product.Id);
        Assert.Equal(9, updatedProduct!.Stock);
    }

    [PgFact]
    public async Task Test02_SellerShipmentRetrieval_LoadsWave6Columns_WithIsolation()
    {
        var (orderService, shipmentService, db) = CreateServices();
        var (buyer, seller, product) = await SeedBuyerSellerProductAsync(db, initialStock: 5, price: 100m);
        var (_, otherSeller, _) = await SeedBuyerSellerProductAsync(db, initialStock: 5, price: 100m);

        var request = new CreateOrderRequest
        {
            DeliveryMethod = "Courier",
            PaymentMethod = "OnReceipt",
            RecipientName = buyer.Name,
            RecipientPhone = buyer.Phone,
            Governorate = "القاهرة",
            City = "القاهرة",
            Area = "المعادي",
            StreetBuilding = "شارع النصر",
            Items = new List<OrderItemRequest>
            {
                new() { ProductId = product.Id, Quantity = 2 }
            }
        };

        var order = await orderService.CreateOrderAsync(buyer.Id, request);

        // Act: Seller retrieves shipments
        var sellerShipments = (await shipmentService.GetSellerShipmentsAsync(seller.Id)).ToList();

        // Assert: Seller sees their shipment with loaded items
        Assert.NotEmpty(sellerShipments);
        var sellerShipment = sellerShipments.FirstOrDefault(s => s.OrderId == order.Id);
        Assert.NotNull(sellerShipment);
        Assert.NotEmpty(sellerShipment.Items);
        var firstItem = sellerShipment.Items.First();
        Assert.Equal(product.Id, firstItem.ProductId);
        Assert.Equal(2, firstItem.Quantity);

        // Verify underlying OrderItem table mapped Wave 6 columns
        await using var verifyDb = PgTestDb.CreateContext();
        var dbItem = await verifyDb.OrderItems.FirstAsync(i => i.ShipmentId == sellerShipment.Id);
        Assert.Equal(0, dbItem.AcceptedQuantity);
        Assert.Equal(0, dbItem.RefusedQuantity);

        // Isolation: Other seller must NOT see this shipment
        var otherSellerShipments = (await shipmentService.GetSellerShipmentsAsync(otherSeller.Id)).ToList();
        Assert.DoesNotContain(otherSellerShipments, s => s.OrderId == order.Id);
    }

    [PgFact]
    public async Task Test03_PartialDelivery_CalculatesCorrectQuantitiesAndRestoresStock()
    {
        var (orderService, shipmentService, db) = CreateServices();
        var (buyer, seller, product) = await SeedBuyerSellerProductAsync(db, initialStock: 10, price: 100m);

        var request = new CreateOrderRequest
        {
            DeliveryMethod = "Courier",
            PaymentMethod = "OnReceipt",
            RecipientName = buyer.Name,
            RecipientPhone = buyer.Phone,
            Governorate = "القاهرة",
            City = "القاهرة",
            Area = "التجمع",
            StreetBuilding = "شارع التسعين",
            Items = new List<OrderItemRequest>
            {
                new() { ProductId = product.Id, Quantity = 4 }
            }
        };

        var order = await orderService.CreateOrderAsync(buyer.Id, request);

        // Simulate separate HTTP request scope for processing delivery by clearing tracker
        db.ChangeTracker.Clear();

        // Product stock deducted by 4 (10 -> 6)
        await using var checkDb1 = PgTestDb.CreateContext();
        var pCheck = await checkDb1.Products.FirstOrDefaultAsync(p => p.Id == product.Id);
        Assert.Equal(6, pCheck!.Stock);

        var shipment = await checkDb1.Shipments.Include(s => s.Items).FirstAsync(s => s.OrderId == order.Id);
        var item = shipment.Items.First();

        // Sub-test A: Invalid quantity sum (Accepted + Refused != Quantity) -> Throws BadRequestException
        var invalidReq = new PartialDeliveryRequest
        {
            Items = new List<PartialDeliveryItemRequest>
            {
                new() { OrderItemId = item.Id, AcceptedQuantity = 2, RefusedQuantity = 1 } // sum is 3 != 4
            }
        };
        await Assert.ThrowsAsync<BadRequestException>(() =>
            shipmentService.ProcessPartialDeliveryAsync(shipment.Id, invalidReq, adminId: 1));

        // Sub-test B: Exceeding quantity -> Throws BadRequestException
        var exceedReq = new PartialDeliveryRequest
        {
            Items = new List<PartialDeliveryItemRequest>
            {
                new() { OrderItemId = item.Id, AcceptedQuantity = 5, RefusedQuantity = 0 } // sum is 5 > 4
            }
        };
        await Assert.ThrowsAsync<BadRequestException>(() =>
            shipmentService.ProcessPartialDeliveryAsync(shipment.Id, exceedReq, adminId: 1));

        // Sub-test C: Valid partial delivery (Accepted = 3, Refused = 1)
        var validReq = new PartialDeliveryRequest
        {
            Items = new List<PartialDeliveryItemRequest>
            {
                new() { OrderItemId = item.Id, AcceptedQuantity = 3, RefusedQuantity = 1 }
            }
        };
        var processedResult = await shipmentService.ProcessPartialDeliveryAsync(shipment.Id, validReq, adminId: 1);

        // Assertions on processedResult and database state
        Assert.NotNull(processedResult);
        Assert.Equal(ShipmentStatus.Delivered.ToString(), processedResult.Status);

        await using var verifyDb = PgTestDb.CreateContext();
        var updatedShipment = await verifyDb.Shipments.Include(s => s.Items).FirstAsync(s => s.Id == shipment.Id);
        var updatedItem = updatedShipment.Items.First();

        Assert.Equal(3, updatedItem.AcceptedQuantity);
        Assert.Equal(1, updatedItem.RefusedQuantity);
        Assert.True(updatedShipment.IsPartiallyDelivered);

        // COD amount adjusted to: (3 * 100) + DeliveryCost
        var expectedCod = (3 * 100m) + updatedShipment.DeliveryCost;
        Assert.Equal(expectedCod, updatedShipment.AdjustedCodAmount);
        Assert.Equal(expectedCod, updatedShipment.CodAmount);

        // Stock restored for refused quantity: from 6 + 1 = 7!
        var restoredProduct = await verifyDb.Products.FirstOrDefaultAsync(p => p.Id == product.Id);
        Assert.Equal(7, restoredProduct!.Stock);
    }

    [PgFact]
    public async Task Test04_Idempotency_SameKeyReturnsSameOrder_DifferentKeyCreatesNew()
    {
        var (orderService, _, db) = CreateServices();
        var (buyer, _, product) = await SeedBuyerSellerProductAsync(db, initialStock: 10, price: 80m);

        var idempotencyKey = "idem-" + Guid.NewGuid().ToString("N");

        var request1 = new CreateOrderRequest
        {
            DeliveryMethod = "Courier",
            PaymentMethod = "OnReceipt",
            RecipientName = buyer.Name,
            RecipientPhone = buyer.Phone,
            Governorate = "القاهرة",
            City = "القاهرة",
            Area = "عين شمس",
            StreetBuilding = "شارع أحمد عصمت",
            IdempotencyKey = idempotencyKey,
            Items = new List<OrderItemRequest>
            {
                new() { ProductId = product.Id, Quantity = 2 }
            }
        };

        // First call
        var firstResponse = await orderService.CreateOrderAsync(buyer.Id, request1);
        Assert.NotNull(firstResponse);

        // Stock deducted by 2 (10 -> 8)
        await using var checkDb1 = PgTestDb.CreateContext();
        var p1 = await checkDb1.Products.FirstOrDefaultAsync(p => p.Id == product.Id);
        Assert.Equal(8, p1!.Stock);

        // Second call with same idempotency key
        var secondResponse = await orderService.CreateOrderAsync(buyer.Id, request1);
        Assert.Equal(firstResponse.Id, secondResponse.Id);

        // Stock MUST NOT be deducted again (still 8)
        await using var checkDb2 = PgTestDb.CreateContext();
        var p2 = await checkDb2.Products.FirstOrDefaultAsync(p => p.Id == product.Id);
        Assert.Equal(8, p2!.Stock);

        // Third call with DIFFERENT idempotency key -> Creates new order
        var request2 = new CreateOrderRequest
        {
            DeliveryMethod = "Courier",
            PaymentMethod = "OnReceipt",
            RecipientName = buyer.Name,
            RecipientPhone = buyer.Phone,
            Governorate = "القاهرة",
            City = "القاهرة",
            Area = "عين شمس",
            StreetBuilding = "شارع أحمد عصمت",
            IdempotencyKey = "different-" + Guid.NewGuid().ToString("N"),
            Items = new List<OrderItemRequest>
            {
                new() { ProductId = product.Id, Quantity = 2 }
            }
        };

        var thirdResponse = await orderService.CreateOrderAsync(buyer.Id, request2);
        Assert.NotEqual(firstResponse.Id, thirdResponse.Id);

        // Stock deducted once more (8 -> 6)
        await using var checkDb3 = PgTestDb.CreateContext();
        var p3 = await checkDb3.Products.FirstOrDefaultAsync(p => p.Id == product.Id);
        Assert.Equal(6, p3!.Stock);
    }

    [PgFact]
    public async Task Test05_TransactionAtomicity_FailureRollsBackAllRecords()
    {
        var (orderService, _, db) = CreateServices();
        var (buyer, _, product) = await SeedBuyerSellerProductAsync(db, initialStock: 2, price: 150m);

        var ordersCountBefore = await db.Orders.CountAsync();
        var shipmentsCountBefore = await db.Shipments.CountAsync();
        var orderItemsCountBefore = await db.OrderItems.CountAsync();

        // Request quantity 5 which exceeds stock of 2 -> Throws BadRequestException
        var failingRequest = new CreateOrderRequest
        {
            DeliveryMethod = "Courier",
            PaymentMethod = "OnReceipt",
            RecipientName = buyer.Name,
            RecipientPhone = buyer.Phone,
            Governorate = "القاهرة",
            City = "القاهرة",
            Area = "شبرا",
            StreetBuilding = "شارع شبرا الرئيسي",
            IdempotencyKey = Guid.NewGuid().ToString("N"),
            Items = new List<OrderItemRequest>
            {
                new() { ProductId = product.Id, Quantity = 5 }
            }
        };

        await Assert.ThrowsAsync<BadRequestException>(() => orderService.CreateOrderAsync(buyer.Id, failingRequest));

        // Verify zero partial records created in DB
        await using var verifyDb = PgTestDb.CreateContext();
        var ordersCountAfter = await verifyDb.Orders.CountAsync();
        var shipmentsCountAfter = await verifyDb.Shipments.CountAsync();
        var orderItemsCountAfter = await verifyDb.OrderItems.CountAsync();

        Assert.Equal(ordersCountBefore, ordersCountAfter);
        Assert.Equal(shipmentsCountBefore, shipmentsCountAfter);
        Assert.Equal(orderItemsCountBefore, orderItemsCountAfter);

        // Verify stock untouched
        var p = await verifyDb.Products.FirstOrDefaultAsync(p => p.Id == product.Id);
        Assert.Equal(2, p!.Stock);
    }

    [PgFact]
    public async Task Test06_MigrationRepairVerification_BothMissingAndExistingPaths()
    {
        var cs = PgTestDb.ConnectionString();
        Assert.NotNull(cs);
        await using var conn = new NpgsqlConnection(cs);
        await conn.OpenAsync();

        // Ensure we are strictly on a test database
        var dbName = conn.Database;
        Assert.EndsWith("_test", dbName, StringComparison.OrdinalIgnoreCase);

        // === PATH A: Missing columns path ===
        var schemaA = "test_drift_repair_a_" + Guid.NewGuid().ToString("N")[..8];
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $@"
                CREATE SCHEMA {schemaA};
                CREATE TABLE {schemaA}.""OrderItems"" (
                    ""Id"" serial PRIMARY KEY,
                    ""OrderId"" integer NOT NULL,
                    ""Quantity"" integer NOT NULL,
                    ""UnitPrice"" numeric(18,2) NOT NULL
                );
                INSERT INTO {schemaA}.""OrderItems"" (""OrderId"", ""Quantity"", ""UnitPrice"")
                VALUES (101, 5, 120.50), (102, 2, 45.00);
            ";
            await cmd.ExecuteNonQueryAsync();
        }

        // Apply guarded repair SQL inside schema A
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = '{schemaA}' AND table_name = 'OrderItems' AND column_name = 'AcceptedQuantity'
                    ) THEN
                        ALTER TABLE {schemaA}.""OrderItems"" ADD COLUMN ""AcceptedQuantity"" integer NOT NULL DEFAULT 0;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = '{schemaA}' AND table_name = 'OrderItems' AND column_name = 'RefusedQuantity'
                    ) THEN
                        ALTER TABLE {schemaA}.""OrderItems"" ADD COLUMN ""RefusedQuantity"" integer NOT NULL DEFAULT 0;
                    END IF;
                END $$;
            ";
            await cmd.ExecuteNonQueryAsync();
        }

        // Verify columns created with integer type and default 0
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $@"
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_schema = '{schemaA}' AND table_name = 'OrderItems' AND column_name IN ('AcceptedQuantity', 'RefusedQuantity')
                ORDER BY column_name;
            ";
            await using var reader = await cmd.ExecuteReaderAsync();
            var found = new List<(string col, string type, string nullable, string def)>();
            while (await reader.ReadAsync())
            {
                found.Add((reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3)));
            }
            Assert.Equal(2, found.Count);
            Assert.Equal("AcceptedQuantity", found[0].col);
            Assert.Equal("integer", found[0].type);
            Assert.Equal("NO", found[0].nullable);
            Assert.Contains("0", found[0].def);

            Assert.Equal("RefusedQuantity", found[1].col);
            Assert.Equal("integer", found[1].type);
            Assert.Equal("NO", found[1].nullable);
            Assert.Contains("0", found[1].def);
        }

        // Verify existing rows preserved intact with 0 defaults
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"SELECT \"Id\", \"OrderId\", \"Quantity\", \"UnitPrice\", \"AcceptedQuantity\", \"RefusedQuantity\" FROM {schemaA}.\"OrderItems\" ORDER BY \"Id\";";
            await using var reader = await cmd.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            Assert.Equal(5, reader.GetInt32(2));
            Assert.Equal(120.50m, reader.GetDecimal(3));
            Assert.Equal(0, reader.GetInt32(4));
            Assert.Equal(0, reader.GetInt32(5));

            Assert.True(await reader.ReadAsync());
            Assert.Equal(2, reader.GetInt32(2));
            Assert.Equal(45.00m, reader.GetDecimal(3));
            Assert.Equal(0, reader.GetInt32(4));
            Assert.Equal(0, reader.GetInt32(5));
        }

        // Cleanup Schema A
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"DROP SCHEMA {schemaA} CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }

        // === PATH B: Already existing columns path ===
        var schemaB = "test_drift_repair_b_" + Guid.NewGuid().ToString("N")[..8];
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $@"
                CREATE SCHEMA {schemaB};
                CREATE TABLE {schemaB}.""OrderItems"" (
                    ""Id"" serial PRIMARY KEY,
                    ""OrderId"" integer NOT NULL,
                    ""Quantity"" integer NOT NULL,
                    ""UnitPrice"" numeric(18,2) NOT NULL,
                    ""AcceptedQuantity"" integer NOT NULL DEFAULT 0,
                    ""RefusedQuantity"" integer NOT NULL DEFAULT 0
                );
                INSERT INTO {schemaB}.""OrderItems"" (""OrderId"", ""Quantity"", ""UnitPrice"", ""AcceptedQuantity"", ""RefusedQuantity"")
                VALUES (201, 3, 90.00, 2, 1);
            ";
            await cmd.ExecuteNonQueryAsync();
        }

        // Re-execute guarded repair SQL against schema B (must succeed without modifying existing values)
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = '{schemaB}' AND table_name = 'OrderItems' AND column_name = 'AcceptedQuantity'
                    ) THEN
                        ALTER TABLE {schemaB}.""OrderItems"" ADD COLUMN ""AcceptedQuantity"" integer NOT NULL DEFAULT 0;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = '{schemaB}' AND table_name = 'OrderItems' AND column_name = 'RefusedQuantity'
                    ) THEN
                        ALTER TABLE {schemaB}.""OrderItems"" ADD COLUMN ""RefusedQuantity"" integer NOT NULL DEFAULT 0;
                    END IF;
                END $$;
            ";
            await cmd.ExecuteNonQueryAsync();
        }

        // Verify existing values (Accepted=2, Refused=1) NOT overwritten
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"SELECT \"AcceptedQuantity\", \"RefusedQuantity\" FROM {schemaB}.\"OrderItems\" WHERE \"OrderId\" = 201;";
            await using var reader = await cmd.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            Assert.Equal(2, reader.GetInt32(0));
            Assert.Equal(1, reader.GetInt32(1));
        }

        // Cleanup Schema B
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"DROP SCHEMA {schemaB} CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task Test07_RequestResponseLoggingMiddleware_LogsFinalStatusAfterExceptionMiddleware()
    {
        // Setup HttpContext
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/orders";
        context.Request.Method = "POST";
        context.Response.Body = new MemoryStream();

        int? loggedStatusCode = null;

        // Custom test logger to capture logged status code
        var testLogger = new ActionLogger<RequestResponseLoggingMiddleware>((logLevel, msg) =>
        {
            if (msg.Contains("responded"))
            {
                // Parse responded 404/500/etc.
                var parts = msg.Split("responded ");
                if (parts.Length > 1)
                {
                    var codeStr = parts[1].Split(' ')[0];
                    if (int.TryParse(codeStr, out var parsedCode))
                    {
                        loggedStatusCode = parsedCode;
                    }
                }
            }
        });

        var loggingMiddleware = new RequestResponseLoggingMiddleware(
            async (innerCtx) =>
            {
                // Simulate GlobalExceptionMiddleware catching exception and formatting error
                try
                {
                    throw new NotFoundException("Order not found");
                }
                catch (NotFoundException nf)
                {
                    innerCtx.Response.StatusCode = (int)HttpStatusCode.NotFound;
                    innerCtx.Response.ContentType = "application/json";
                    await innerCtx.Response.WriteAsync(JsonSerializer.Serialize(new { status = 404, error = nf.Message }));
                }
            },
            testLogger);

        // Act
        await loggingMiddleware.InvokeAsync(context);

        // Assert: Logging middleware logged 404 (NOT 200)
        Assert.Equal(404, context.Response.StatusCode);
        Assert.Equal(404, loggedStatusCode);

        // Verify response body does not expose sensitive internals
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Contains("Order not found", body);
        Assert.DoesNotContain("Exception", body);
        Assert.DoesNotContain("StackTrace", body);
    }

    private sealed class ActionLogger<T> : ILogger<T>
    {
        private readonly Action<LogLevel, string> _onLog;
        public ActionLogger(Action<LogLevel, string> onLog) => _onLog = onLog;
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            _onLog(logLevel, formatter(state, exception));
        }
    }
}
