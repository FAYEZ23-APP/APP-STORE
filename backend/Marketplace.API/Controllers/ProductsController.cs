using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Products;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/products")]
[Authorize(Roles = "Seller")] // Restrict entire controller to Sellers for now (Phase 4 scope)
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;
    private readonly IImageUploadService _imageUploadService;
    private readonly IConfiguration _configuration;

    public ProductsController(
        IProductService productService,
        IImageUploadService imageUploadService,
        IConfiguration configuration)
    {
        _productService = productService;
        _imageUploadService = imageUploadService;
        _configuration = configuration;
    }

    /// <summary>Upload a single product image (magic-byte verified, EXIF/GPS stripped, dimension-limited, ownership-tracked). (Seller only)</summary>
    [HttpPost("upload-image")]
    [Authorize(Roles = "Seller")]
    [EnableRateLimiting("upload-policy")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UploadImage(IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No image file provided." });
        }

        var sellerId = User.GetUserId();
        await using var stream = file.OpenReadStream();
        var result = await _imageUploadService.ProcessAndSaveImageAsync(
            sellerId,
            stream,
            file.FileName,
                file.Length,
                subFolder: null,
                clientContentType: file.ContentType,
                category: Marketplace.Domain.Enums.FileCategory.ProductImage);

        return Ok(new
        {
            url = result.Url,
            width = result.Width,
            height = result.Height,
            sizeBytes = result.SizeBytes
        });
    }

    /// <summary>Upload multiple product images in a single request (up to MaxImagesPerProduct, default 8). (Seller only)</summary>
    [HttpPost("upload-images")]
    [Authorize(Roles = "Seller")]
    [EnableRateLimiting("upload-policy")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UploadImages(List<IFormFile>? files)
    {
        if (files == null || files.Count == 0)
        {
            return BadRequest(new { error = "No image files provided." });
        }

        var maxImages = _configuration.GetValue<int>("Products:MaxImagesPerProduct", 8);
        if (files.Count > maxImages)
        {
            return BadRequest(new { error = $"Cannot upload more than {maxImages} images at once." });
        }

        var sellerId = User.GetUserId();
        var results = new List<ImageUploadResult>(files.Count);

        foreach (var file in files)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "One or more image files are empty." });
            }

            await using var stream = file.OpenReadStream();
            var result = await _imageUploadService.ProcessAndSaveImageAsync(
                sellerId,
                stream,
                file.FileName,
                file.Length,
                subFolder: null,
                clientContentType: file.ContentType,
                category: Marketplace.Domain.Enums.FileCategory.ProductImage);
            results.Add(result);
        }

        return Ok(new
        {
            urls = results.Select(r => r.Url).ToList(),
            files = results.Select(r => new
            {
                url = r.Url,
                width = r.Width,
                height = r.Height,
                sizeBytes = r.SizeBytes
            }).ToList()
        });
    }

    /// <summary>Add a new product. (Seller only)</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ProductResponse>> CreateProduct(CreateProductRequest request)
    {
        var sellerId = User.GetUserId();
        var product = await _productService.CreateProductAsync(sellerId, request);

        return StatusCode(StatusCodes.Status201Created, product);
    }

    /// <summary>Update an existing product. Must be the owner. (Seller only)</summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponse>> UpdateProduct(int id, UpdateProductRequest request)
    {
        var sellerId = User.GetUserId();
        var product = await _productService.UpdateProductAsync(sellerId, id, request);
        return Ok(product);
    }

    /// <summary>Quick update product stock and/or price from seller dashboard. (Seller only)</summary>
    [HttpPatch("{id:int}/quick-stock")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponse>> QuickStock(int id, Marketplace.Application.DTOs.Dashboard.QuickStockUpdateRequest request)
    {
        var sellerId = User.GetUserId();
        var product = await _productService.QuickStockUpdateAsync(sellerId, id, request);
        return Ok(product);
    }

    /// <summary>Delete a product. Must be the owner. (Seller only)</summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteProduct(int id)
    {
        var sellerId = User.GetUserId();
        await _productService.DeleteProductAsync(sellerId, id);
        return NoContent();
    }

    /// <summary>Get all products belonging to the logged-in seller. (Seller only)</summary>
    [HttpGet("my-products")]
    [ProducesResponseType(typeof(IEnumerable<ProductResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<ProductResponse>>> GetMyProducts()
    {
        var sellerId = User.GetUserId();
        var products = await _productService.GetSellerProductsAsync(sellerId);
        return Ok(products);
    }

    /// <summary>Get all products with optional filters, sort, search, and pagination. (Public)</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IEnumerable<ProductResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ProductResponse>>> GetAllProducts(
        [FromQuery] int? categoryId = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? search = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] bool? hasDiscount = null,
        [FromQuery] int? sellerId = null)
    {
        var products = await _productService.GetAllProductsAsync(categoryId, sort, search, page, pageSize, hasDiscount, sellerId);
        return Ok(products);
    }

    /// <summary>Get public storefront details and products for a seller. (Public)</summary>
    [HttpGet("store/{sellerId:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(SellerStorefrontResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SellerStorefrontResponse>> GetSellerStorefront(
        int sellerId,
        [FromQuery] int? categoryId = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? search = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var storefront = await _productService.GetSellerStorefrontAsync(sellerId, categoryId, sort, search, page, pageSize);
        return Ok(storefront);
    }

    /// <summary>Get a product by ID. (Public)</summary>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponse>> GetProductById(int id)
    {
        var product = await _productService.GetProductByIdAsync(id);
        return Ok(product);
    }

    /// <summary>Search products by name or description. (Public)</summary>
    [HttpGet("search")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IEnumerable<ProductResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ProductResponse>>> SearchProducts([FromQuery] string query)
    {
        var products = await _productService.SearchProductsAsync(query);
        return Ok(products);
    }

    /// <summary>Download CSV template for bulk product upload.</summary>
    [HttpGet("bulk-template")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public IActionResult DownloadBulkTemplate()
    {
        var bytes = _productService.GenerateBulkUploadTemplate();
        return File(bytes, "text/csv; charset=utf-8", "products_bulk_template.csv");
    }

    /// <summary>Bulk upload or update products from CSV file.</summary>
    [HttpPost("bulk-upload")]
    [Authorize(Roles = "Seller")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(BulkProductUploadReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<BulkProductUploadReportDto>> BulkUploadProducts([FromForm] Microsoft.AspNetCore.Http.IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "الملف مطلوب ولم يتم اختياره." });

        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "صيغة الملف غير مدعومة؛ يجب رفع ملف CSV." });

        var sellerId = User.GetUserId();
        using var stream = file.OpenReadStream();
        var report = await _productService.BulkUploadProductsAsync(sellerId, stream);
        return Ok(report);
    }

}
