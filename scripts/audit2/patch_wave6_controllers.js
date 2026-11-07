const fs = require('fs');
const path = require('path');

// 1. ProductsController.cs
const prodCtrlPath = path.join(__dirname, '../../backend/Marketplace.API/Controllers/ProductsController.cs');
let prodCtrl = fs.readFileSync(prodCtrlPath, 'utf8');

if (!prodCtrl.includes('BulkUploadProducts')) {
    const endpoints = `
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
`;
    const lastClosing = prodCtrl.lastIndexOf('}');
    prodCtrl = prodCtrl.slice(0, lastClosing) + endpoints + '\n' + prodCtrl.slice(lastClosing);
    fs.writeFileSync(prodCtrlPath, prodCtrl, 'utf8');
    console.log('Patched ProductsController.cs with bulk upload endpoints');
}

// 2. AdminController.cs
const adminCtrlPath = path.join(__dirname, '../../backend/Marketplace.API/Controllers/AdminController.cs');
let adminCtrl = fs.readFileSync(adminCtrlPath, 'utf8');

if (!adminCtrl.includes('ReconcileCarrierSheet')) {
    const endpoints = `
    /// <summary>Reconcile carrier remittance sheet against system shipments.</summary>
    [HttpPost("shipments/reconcile-sheet")]
    [ProducesResponseType(typeof(CarrierRemittanceBatchDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CarrierRemittanceBatchDto>> ReconcileCarrierSheet([FromBody] ReconcileCarrierSheetRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _shipmentService.ReconcileCarrierSheetAsync(adminId, request);
        return Ok(result);
    }

    /// <summary>Process doorstep partial delivery with item acceptance and refusal restock.</summary>
    [HttpPost("shipments/{id:int}/partial-delivery")]
    [ProducesResponseType(typeof(SellerShipmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SellerShipmentResponse>> ProcessPartialDelivery(int id, [FromBody] PartialDeliveryRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _shipmentService.ProcessPartialDeliveryAsync(id, request, adminId);
        return Ok(result);
    }
`;
    const lastClosing = adminCtrl.lastIndexOf('}');
    adminCtrl = adminCtrl.slice(0, lastClosing) + endpoints + '\n' + adminCtrl.slice(lastClosing);
    fs.writeFileSync(adminCtrlPath, adminCtrl, 'utf8');
    console.log('Patched AdminController.cs with remittance reconcile and partial delivery');
}

// 3. ShipmentsController.cs
const shipCtrlPath = path.join(__dirname, '../../backend/Marketplace.API/Controllers/ShipmentsController.cs');
let shipCtrl = fs.readFileSync(shipCtrlPath, 'utf8');

if (!shipCtrl.includes('GetThermalWaybill')) {
    const endpoints = `
    /// <summary>Generate printable 4x6 thermal waybill with SVG Code-128 barcode.</summary>
    [HttpGet("{id:int}/waybill")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetThermalWaybill(int id)
    {
        var userId = User.GetUserId();
        var role = User.IsInRole("Admin") ? "Admin" : (User.IsInRole("Seller") ? "Seller" : "Buyer");
        var html = await _shipmentService.GenerateWaybillHtmlAsync(id, userId, role);
        return Content(html, "text/html; charset=utf-8");
    }
`;
    const lastClosing = shipCtrl.lastIndexOf('}');
    shipCtrl = shipCtrl.slice(0, lastClosing) + endpoints + '\n' + shipCtrl.slice(lastClosing);
    fs.writeFileSync(shipCtrlPath, shipCtrl, 'utf8');
    console.log('Patched ShipmentsController.cs with thermal waybill');
}
