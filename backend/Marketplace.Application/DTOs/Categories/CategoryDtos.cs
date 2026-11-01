namespace Marketplace.Application.DTOs.Categories;

public class CategoryResponse
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string IconName { get; set; } = string.Empty;
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; } = 0;
    public int ProductCount { get; set; }
}

public class CreateCategoryRequest
{
    public string Key { get; set; } = string.Empty;
    public string IconName { get; set; } = string.Empty;
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public int DisplayOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}

public class UpdateCategoryRequest
{
    public string? Key { get; set; }
    public string? IconName { get; set; }
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public int? DisplayOrder { get; set; }
    public bool? IsActive { get; set; }
}
