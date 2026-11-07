namespace Marketplace.Application.DTOs.Products;

public class BulkProductUploadReportDto
{
    public int TotalRows { get; set; }
    public int InsertedCount { get; set; }
    public int UpdatedCount { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class BulkProductRowDto
{
    public int RowNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal? OldPrice { get; set; }
    public int Stock { get; set; }
    public string? DispatchCity { get; set; }
    public bool AllowInspection { get; set; } = true;
    public string? Sku { get; set; }
    public string? VariantColor { get; set; }
    public string? VariantSize { get; set; }
}
