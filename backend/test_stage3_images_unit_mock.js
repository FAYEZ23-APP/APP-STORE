/**
 * Stage 3 Unit/Mock Verification Script (test_stage3_images_unit_mock.js)
 * NOTE: Uses in-process mock IUnitOfWork + real SkiaSharp + real ImageUploadService + real ProductService + real FluentValidation
 * (Does NOT use PostgreSQL TEST_DB and is NOT counted as PostgreSQL verification).
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tempCsProjDir = path.join(process.env.TEMP || __dirname, 'Stage3UnitVerifyRunner');
fs.mkdirSync(tempCsProjDir, { recursive: true });

const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
    <ProjectReference Include="d:\\backend\\marketplace\\backend\\Marketplace.Domain\\Marketplace.Domain.csproj" />
    <ProjectReference Include="d:\\backend\\marketplace\\backend\\Marketplace.Application\\Marketplace.Application.csproj" />
    <ProjectReference Include="d:\\backend\\marketplace\\backend\\Marketplace.Infrastructure\\Marketplace.Infrastructure.csproj" />
  </ItemGroup>
</Project>
`;

const programCs = `using System.Linq.Expressions;
using System.Text;
using Marketplace.Application.DTOs.Products;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Application.Services;
using Marketplace.Application.Validators.Products;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using SkiaSharp;

public class MockRepo<T> : IRepository<T> where T : class
{
    public readonly List<T> Items = new();
    public Task<T?> GetByIdAsync(int id)
    {
        var prop = typeof(T).GetProperty("Id");
        var item = Items.FirstOrDefault(x => (int)prop!.GetValue(x)! == id);
        return Task.FromResult(item);
    }
    public Task<IEnumerable<T>> GetAllAsync() => Task.FromResult<IEnumerable<T>>(Items.ToList());
    public Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
    {
        var fn = predicate.Compile();
        return Task.FromResult<IEnumerable<T>>(Items.Where(fn).ToList());
    }
    public IQueryable<T> Query() => Items.AsQueryable();
    public Task AddAsync(T entity)
    {
        var prop = typeof(T).GetProperty("Id");
        if (prop != null && (int)prop.GetValue(entity)! == 0)
            prop.SetValue(entity, Items.Count + 1);
        Items.Add(entity);
        return Task.CompletedTask;
    }
    public void Update(T entity) { }
    public void Remove(T entity) => Items.Remove(entity);
}

public class MockUow : IUnitOfWork
{
    public MockRepo<User> UsersRepo = new();
    public MockRepo<SellerProfile> SellerProfilesRepo = new();
    public MockRepo<Category> CategoriesRepo = new();
    public MockRepo<Product> ProductsRepo = new();
    public MockRepo<ProductVariant> ProductVariantsRepo = new();
    public MockRepo<UploadedFile> UploadedFilesRepo = new();

    public IRepository<User> Users => UsersRepo;
    public IRepository<SellerProfile> SellerProfiles => SellerProfilesRepo;
    public IRepository<UserAddress> UserAddresses => throw new NotImplementedException();
    public IRepository<Product> Products => ProductsRepo;
    public IRepository<Category> Categories => CategoriesRepo;
    public IRepository<Order> Orders => throw new NotImplementedException();
    public IRepository<Shipment> Shipments => throw new NotImplementedException();
    public IRepository<OrderItem> OrderItems => throw new NotImplementedException();
    public IRepository<UserConsent> UserConsents => throw new NotImplementedException();
    public IRepository<VendorWallet> VendorWallets => throw new NotImplementedException();
    public IRepository<WalletTransaction> WalletTransactions => throw new NotImplementedException();
    public IRepository<PayoutRequest> PayoutRequests => throw new NotImplementedException();
    public IRepository<Review> Reviews => throw new NotImplementedException();
    public IRepository<UserDeviceToken> UserDeviceTokens => throw new NotImplementedException();
    public IRepository<ProductVariant> ProductVariants => ProductVariantsRepo;
    public IRepository<Coupon> Coupons => throw new NotImplementedException();
    public IRepository<CouponUsage> CouponUsages => throw new NotImplementedException();
    public IRepository<ReturnRequest> ReturnRequests => throw new NotImplementedException();
    public IRepository<BuyerWallet> BuyerWallets => throw new NotImplementedException();
    public IRepository<BuyerWalletTransaction> BuyerWalletTransactions => throw new NotImplementedException();
    public IRepository<VerificationCode> VerificationCodes => throw new NotImplementedException();
    public IRepository<RefreshToken> RefreshTokens => throw new NotImplementedException();
    public IRepository<UploadedFile> UploadedFiles => UploadedFilesRepo;
    public IRepository<ReviewReport> ReviewReports => throw new NotImplementedException();
    public IRepository<ExternalLogin> ExternalLogins => throw new NotImplementedException();

    public Task RecomputeProductRatingAsync(int productId) => Task.CompletedTask;

    public Task<int> SaveChangesAsync() => Task.FromResult(1);
    public Task BeginTransactionAsync() => Task.CompletedTask;
    public Task CommitTransactionAsync() => Task.CompletedTask;
    public Task RollbackTransactionAsync() => Task.CompletedTask;
    public Task<int> ExecuteSqlRawAsync(string sql, params object[] parameters) => Task.FromResult(1);
    public void Dispose() { }
}

public class MockWebEnv : IWebHostEnvironment
{
    public string WebRootPath { get; set; } = string.Empty;
    public IFileProvider WebRootFileProvider { get; set; } = null!;
    public string ApplicationName { get; set; } = "Test";
    public IFileProvider ContentRootFileProvider { get; set; } = null!;
    public string ContentRootPath { get; set; } = string.Empty;
    public string EnvironmentName { get; set; } = "Development";
}

public static class Program
{
    private static byte[] CreateJpegWithExifGps(int width, int height)
    {
        using var bmp = new SKBitmap(width, height);
        using (var canvas = new SKCanvas(bmp))
        {
            canvas.Clear(SKColors.CornflowerBlue);
        }
        using var img = SKImage.FromBitmap(bmp);
        using var encoded = img.Encode(SKEncodedImageFormat.Jpeg, 90);
        var rawJpeg = encoded.ToArray();

        // Inject APP1 (0xFFE1) Exif + GPS IFD (0x8825) right after SOI (FF D8)
        var exifBytes = Encoding.Latin1.GetBytes("Exif\\0\\0MM\\0*\\0\\0\\0\\x08\\0\\x01\\x88\\x25\\0\\x04\\0\\0\\0\\x01\\0\\0\\0\\x1a\\0\\0\\0\\0GPS_LAT_30.0444_LON_31.2357");
        int len = exifBytes.Length + 2;
        var app1 = new byte[4 + exifBytes.Length];
        app1[0] = 0xFF;
        app1[1] = 0xE1;
        app1[2] = (byte)((len >> 8) & 0xFF);
        app1[3] = (byte)(len & 0xFF);
        Buffer.BlockCopy(exifBytes, 0, app1, 4, exifBytes.Length);

        var combined = new byte[2 + app1.Length + (rawJpeg.Length - 2)];
        combined[0] = 0xFF;
        combined[1] = 0xD8;
        Buffer.BlockCopy(app1, 0, combined, 2, app1.Length);
        Buffer.BlockCopy(rawJpeg, 2, combined, 2 + app1.Length, rawJpeg.Length - 2);
        return combined;
    }

    private static bool ContainsExifOrGps(byte[] bytes)
    {
        var latin1 = Encoding.Latin1.GetString(bytes);
        if (latin1.Contains("Exif\\0\\0") || latin1.Contains("GPS_LAT_30.0444"))
            return true;

        if (bytes.Length >= 4 && bytes[0] == 0xFF && bytes[1] == 0xD8)
        {
            int idx = 2;
            while (idx + 4 <= bytes.Length && bytes[idx] == 0xFF)
            {
                byte marker = bytes[idx + 1];
                if (marker == 0xDA || marker == 0xD9) break;
                if (marker == 0xE1) return true; // APP1 Exif segment
                int segLen = (bytes[idx + 2] << 8) | bytes[idx + 3];
                if (segLen < 2) break;
                idx += 2 + segLen;
            }
        }
        return false;
    }

    public static async Task Main()
    {
        var tempRoot = Path.Combine(Path.GetTempPath(), "stage3_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);

        try
        {
            var uow = new MockUow();
            await uow.UsersRepo.AddAsync(new User { Id = 1, Name = "Seller One", Email = "s1@test.com" });
            await uow.UsersRepo.AddAsync(new User { Id = 2, Name = "Seller Two", Email = "s2@test.com" });
            await uow.SellerProfilesRepo.AddAsync(new SellerProfile { Id = 1, UserId = 1, DispatchCity = "Cairo" });
            await uow.SellerProfilesRepo.AddAsync(new SellerProfile { Id = 2, UserId = 2, DispatchCity = "Giza" });
            await uow.CategoriesRepo.AddAsync(new Category { Id = 1, Key = "electronics", IconName = "devices" });

            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Products:MaxImagesPerProduct"] = "8",
                    ["Uploads:MaxFileSizeBytes"] = "5242880",
                    ["Uploads:MaxImageDimension"] = "1600",
                    ["Uploads:MaxInputDimension"] = "8192",
                    ["Uploads:JpegWebpQuality"] = "85"
                })
                .Build();

            var env = new MockWebEnv { WebRootPath = tempRoot };
            var uploadSvc = new ImageUploadService(uow, env, config);
            var productSvc = new ProductService(uow, uploadSvc);
            var validator = new CreateProductRequestValidator(uow, config);

            // 1. Test EXIF/GPS removal + dimension downscaling (2400x1800 -> 1600x1200)
            var inputJpeg = CreateJpegWithExifGps(2400, 1800);
            if (!ContainsExifOrGps(inputJpeg))
                throw new Exception("Setup error: input JPEG missing EXIF/GPS");

            using var ms1 = new MemoryStream(inputJpeg);
            var uploaded1 = await uploadSvc.ProcessAndSaveImageAsync(1, ms1, "camera_gps.jpg", inputJpeg.Length);
            var storedFilePath = Path.Combine(tempRoot, "uploads", uploaded1.FileName);
            var storedBytes = await File.ReadAllBytesAsync(storedFilePath);

            if (ContainsExifOrGps(storedBytes))
                throw new Exception("FAIL: Stored file still contains EXIF/GPS metadata");
            if (uploaded1.Width != 1600 || uploaded1.Height != 1200)
                throw new Exception($"FAIL: Expected downscaled 1600x1200, got {uploaded1.Width}x{uploaded1.Height}");
            Console.WriteLine($"[PASS] Test 1 (EXIF GPS removed & dimensions downscaled): inputHadExifGps=true, storedHasExifGps=false, resized=2400x1800->{uploaded1.Width}x{uploaded1.Height}, url={uploaded1.Url}");

            // 2. Test fake .png with text content rejected
            var fakePngBytes = Encoding.UTF8.GetBytes("This is plain text pretending to be a PNG file.");
            using var msFake = new MemoryStream(fakePngBytes);
            bool fakeRejected = false;
            try
            {
                await uploadSvc.ProcessAndSaveImageAsync(1, msFake, "fake.png", fakePngBytes.Length);
            }
            catch (BadRequestException ex)
            {
                fakeRejected = true;
                Console.WriteLine($"[PASS] Test 2 (Fake .png with text content rejected): {ex.Message}");
            }
            if (!fakeRejected) throw new Exception("FAIL: Fake .png was not rejected");

            // 3. Test foreign/external URL rejected (both Validator and ProductService)
            var extReq = new CreateProductRequest
            {
                Name = "Test",
                Description = "Desc",
                Price = 100,
                Stock = 5,
                WeightGrams = 500,
                CategoryId = 1,
                ImageUrls = new List<string> { "https://external.example.com/photo.jpg" }
            };
            var valResExt = await validator.ValidateAsync(extReq);
            bool externalRejected = false;
            try
            {
                await productSvc.CreateProductAsync(1, extReq);
            }
            catch (BadRequestException ex)
            {
                externalRejected = true;
                Console.WriteLine($"[PASS] Test 3 (Foreign/external URL rejected): validatorValid={valResExt.IsValid}, serviceError={ex.Message}");
            }
            if (valResExt.IsValid || !externalRejected) throw new Exception("FAIL: External URL was not rejected");

            // 4. Test another seller's file rejected (Seller 2 uploads, Seller 1 tries to use it)
            using var msSeller2 = new MemoryStream(inputJpeg);
            var seller2File = await uploadSvc.ProcessAndSaveImageAsync(2, msSeller2, "s2.jpg", inputJpeg.Length);
            bool otherSellerRejected = false;
            try
            {
                await productSvc.CreateProductAsync(1, new CreateProductRequest
                {
                    Name = "Stolen Image Product",
                    Description = "Desc",
                    Price = 100,
                    Stock = 5,
                    WeightGrams = 500,
                    CategoryId = 1,
                    ImageUrls = new List<string> { seller2File.Url }
                });
            }
            catch (BadRequestException ex)
            {
                otherSellerRejected = true;
                Console.WriteLine($"[PASS] Test 4 (Another seller's file rejected): {ex.Message}");
            }
            if (!otherSellerRejected) throw new Exception("FAIL: Another seller's file was not rejected");

            // 5. Test 9th image rejected
            var seller1Urls = new List<string> { uploaded1.Url };
            for (int i = 0; i < 8; i++)
            {
                using var ms = new MemoryStream(inputJpeg);
                var up = await uploadSvc.ProcessAndSaveImageAsync(1, ms, $"img_{i}.jpg", inputJpeg.Length);
                seller1Urls.Add(up.Url);
            }
            var nineReq = new CreateProductRequest
            {
                Name = "9 Images Product",
                Description = "Desc",
                Price = 100,
                Stock = 5,
                WeightGrams = 500,
                CategoryId = 1,
                ImageUrls = seller1Urls // 9 images
            };
            var valResNine = await validator.ValidateAsync(nineReq);
            bool ninthRejected = false;
            try
            {
                await productSvc.CreateProductAsync(1, nineReq);
            }
            catch (BadRequestException ex)
            {
                ninthRejected = true;
                Console.WriteLine($"[PASS] Test 5 (9th image rejected): validatorValid={valResNine.IsValid}, serviceError={ex.Message}");
            }
            if (valResNine.IsValid || !ninthRejected) throw new Exception("FAIL: 9th image was not rejected");

            // 6. Test 8 ordered images accepted (first = main image)
            var valid8 = seller1Urls.Take(8).ToList();
            var created = await productSvc.CreateProductAsync(1, new CreateProductRequest
            {
                Name = "Valid 8 Images Product",
                Description = "Desc",
                Price = 100,
                Stock = 5,
                WeightGrams = 500,
                CategoryId = 1,
                ImageUrls = valid8
            });
            if (created.ImageUrls.Count != 8 || !created.ImageUrls.SequenceEqual(valid8))
                throw new Exception("FAIL: Ordered ImageUrls were not preserved");
            Console.WriteLine($"[PASS] Test 6 (8 ordered images accepted & order preserved): count={created.ImageUrls.Count}, main={created.ImageUrls[0]}");
            Console.WriteLine("ALL 6 STAGE 3 UNIT/MOCK VERIFICATION CHECKS PASSED!");
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, true);
        }
    }
}
`;

fs.writeFileSync(path.join(tempCsProjDir, 'Stage3UnitVerifyRunner.csproj'), csproj);
fs.writeFileSync(path.join(tempCsProjDir, 'Program.cs'), programCs);

const env = { ...process.env, DOTNET_EnableWriteXorExecute: '0', MSBUILDDISABLENODEREUSE: '1' };
const res = spawnSync('dotnet', ['run', '--project', path.join(tempCsProjDir, 'Stage3UnitVerifyRunner.csproj'), '/p:UseSharedCompilation=false', '-m:1'], {
  env,
  encoding: 'utf8',
  stdio: 'inherit'
});
process.exit(res.status ?? 0);
