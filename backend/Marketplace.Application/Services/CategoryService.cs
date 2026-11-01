using Marketplace.Application.DTOs.Categories;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

public class CategoryService : ICategoryService
{
    private readonly IUnitOfWork _uow;
    private static readonly System.Text.RegularExpressions.Regex ArabicNameRegex = new(@"^[\u0600-\u06FF0-9\s\-&',.()]{2,100}$", System.Text.RegularExpressions.RegexOptions.Compiled);
    private static readonly System.Text.RegularExpressions.Regex ArabicLettersRegex = new(@"[\u0600-\u06FF]", System.Text.RegularExpressions.RegexOptions.Compiled);
    private static readonly System.Text.RegularExpressions.Regex EnglishNameRegex = new(@"^[a-zA-Z0-9\s\-&',.()]{2,100}$", System.Text.RegularExpressions.RegexOptions.Compiled);
    private static readonly System.Text.RegularExpressions.Regex EnglishLettersRegex = new(@"[a-zA-Z]", System.Text.RegularExpressions.RegexOptions.Compiled);

    public CategoryService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    private static void ValidateBilingualNames(string? nameAr, string? nameEn, bool isRequired)
    {
        if (isRequired || nameAr != null)
        {
            var cleanAr = nameAr?.Trim();
            if (string.IsNullOrWhiteSpace(cleanAr))
                throw new BadRequestException("اسم الفئة باللغة العربية مطلوب (Arabic category name is required).");

            if (cleanAr.Length < 2 || cleanAr.Length > 100)
                throw new BadRequestException("يجب أن يكون اسم الفئة بالعربية بين 2 و 100 حرف.");

            if (!ArabicNameRegex.IsMatch(cleanAr) || !ArabicLettersRegex.IsMatch(cleanAr))
                throw new BadRequestException("اسم الفئة بالعربية يجب أن يحتوي على حروف عربية صالحة.");
        }

        if (isRequired || nameEn != null)
        {
            var cleanEn = nameEn?.Trim();
            if (string.IsNullOrWhiteSpace(cleanEn))
                throw new BadRequestException("اسم الفئة باللغة الإنجليزية مطلوب (English category name is required).");

            if (cleanEn.Length < 2 || cleanEn.Length > 100)
                throw new BadRequestException("يجب أن يكون اسم الفئة بالإنجليزية بين 2 و 100 حرف.");

            if (!EnglishNameRegex.IsMatch(cleanEn) || !EnglishLettersRegex.IsMatch(cleanEn))
                throw new BadRequestException("اسم الفئة بالإنجليزية يجب أن يحتوي على حروف لاتينية صالحة.");
        }
    }

    public async Task<IEnumerable<CategoryResponse>> GetAllCategoriesAsync(bool includeInactive = false)
    {
        var query = _uow.Categories.Query().Include(c => c.Products);

        var categories = await (includeInactive ? query : query.Where(c => c.IsActive))
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Id)
            .ToListAsync();

        return categories
            .Select(c => new CategoryResponse
            {
                Id = c.Id,
                Key = c.Key,
                IconName = c.IconName,
                NameAr = c.NameAr,
                NameEn = c.NameEn,
                IsActive = c.IsActive,
                DisplayOrder = c.DisplayOrder,
                ProductCount = c.Products?.Count(p => !p.IsDeleted) ?? 0
            })
            .ToList();
    }

    public async Task<CategoryResponse> GetCategoryByIdAsync(int id)
    {
        var category = await _uow.Categories.Query()
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            throw new NotFoundException($"Category with ID {id} was not found.");

        return new CategoryResponse
        {
            Id = category.Id,
            Key = category.Key,
            IconName = category.IconName,
            NameAr = category.NameAr,
            NameEn = category.NameEn,
            IsActive = category.IsActive,
            DisplayOrder = category.DisplayOrder,
            ProductCount = category.Products?.Count(p => !p.IsDeleted) ?? 0
        };
    }

    public async Task<CategoryResponse> CreateCategoryAsync(CreateCategoryRequest request, int? adminId = null)
    {
        ValidateBilingualNames(request.NameAr, request.NameEn, isRequired: true);

        var cleanKey = request.Key?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(cleanKey) && !string.IsNullOrWhiteSpace(request.NameEn))
        {
            cleanKey = System.Text.RegularExpressions.Regex.Replace(request.NameEn.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        }

        if (string.IsNullOrWhiteSpace(cleanKey))
        {
            cleanKey = $"cat-{Guid.NewGuid():N}"[..10];
        }

        if (!System.Text.RegularExpressions.Regex.IsMatch(cleanKey, @"^[a-z0-9_-]{2,50}$"))
        {
            throw new BadRequestException("رمز الفئة غير صالح (يجب أن يتكون من 2 إلى 50 حرفاً إنجليزياً أو أرقام أو شرطات فقط).");
        }

        var existing = (await _uow.Categories.FindAsync(c => c.Key == cleanKey)).FirstOrDefault();
        if (existing != null)
        {
            if (!string.IsNullOrWhiteSpace(request.Key))
            {
                throw new BadRequestException($"الفئة بالرمز '{cleanKey}' موجودة بالفعل.");
            }
            cleanKey = $"{cleanKey}-{Guid.NewGuid():N}"[..Math.Min(cleanKey.Length + 7, 50)];
        }

        var category = new Category
        {
            Key = cleanKey,
            IconName = string.IsNullOrWhiteSpace(request.IconName) ? "shape-outline" : request.IconName.Trim(),
            NameAr = request.NameAr?.Trim(),
            NameEn = request.NameEn?.Trim(),
            IsActive = request.IsActive,
            DisplayOrder = request.DisplayOrder
        };

        await _uow.Categories.AddAsync(category);
        await _uow.SaveChangesAsync();

        // Write AdminAuditLog row
        var audit = new AdminAuditLog
        {
            AdminId = adminId,
            Action = "CreateCategory",
            EntityType = "Category",
            EntityId = category.Id.ToString(),
            Details = $"Created category '{category.Key}' (Ar: '{category.NameAr}', En: '{category.NameEn}', Order: {category.DisplayOrder}, Active: {category.IsActive})",
            CreatedAt = DateTime.UtcNow
        };
        await _uow.AdminAuditLogs.AddAsync(audit);
        await _uow.SaveChangesAsync();

        return new CategoryResponse
        {
            Id = category.Id,
            Key = category.Key,
            IconName = category.IconName,
            NameAr = category.NameAr,
            NameEn = category.NameEn,
            IsActive = category.IsActive,
            DisplayOrder = category.DisplayOrder,
            ProductCount = 0
        };
    }

    public async Task<CategoryResponse> UpdateCategoryAsync(int id, UpdateCategoryRequest request, int? adminId = null)
    {
        var category = await _uow.Categories.GetByIdAsync(id);
        if (category == null)
            throw new NotFoundException($"Category with ID {id} was not found.");

        // Category key is strictly immutable after creation
        if (!string.IsNullOrWhiteSpace(request.Key) && request.Key.Trim().ToLowerInvariant() != category.Key)
        {
            throw new BadRequestException("رمز الفئة غير قابل للتعديل بعد الإنشاء (Category key is immutable).");
        }

        ValidateBilingualNames(request.NameAr, request.NameEn, isRequired: false);

        if (request.IconName != null)
            category.IconName = request.IconName.Trim();

        if (request.NameAr != null)
            category.NameAr = request.NameAr.Trim();

        if (request.NameEn != null)
            category.NameEn = request.NameEn.Trim();

        if (request.DisplayOrder.HasValue)
            category.DisplayOrder = request.DisplayOrder.Value;

        if (request.IsActive.HasValue)
            category.IsActive = request.IsActive.Value;

        _uow.Categories.Update(category);
        await _uow.SaveChangesAsync();

        // Write AdminAuditLog row
        var audit = new AdminAuditLog
        {
            AdminId = adminId,
            Action = "UpdateCategory",
            EntityType = "Category",
            EntityId = id.ToString(),
            Details = $"Updated category #{id} '{category.Key}' (Ar: '{category.NameAr}', En: '{category.NameEn}', Order: {category.DisplayOrder}, Active: {category.IsActive})",
            CreatedAt = DateTime.UtcNow
        };
        await _uow.AdminAuditLogs.AddAsync(audit);
        await _uow.SaveChangesAsync();

        var products = await _uow.Products.FindAsync(p => p.CategoryId == id && !p.IsDeleted);

        return new CategoryResponse
        {
            Id = category.Id,
            Key = category.Key,
            IconName = category.IconName,
            NameAr = category.NameAr,
            NameEn = category.NameEn,
            IsActive = category.IsActive,
            DisplayOrder = category.DisplayOrder,
            ProductCount = products.Count()
        };
    }

    public async Task<bool> DeleteCategoryAsync(int id, int? adminId = null)
    {
        var category = await _uow.Categories.Query()
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            throw new NotFoundException($"Category with ID {id} was not found.");

        // The delete guard counts ALL products referencing this category (including soft-deleted)
        var totalProductsCount = await _uow.Products.Query().CountAsync(p => p.CategoryId == id);
        if (totalProductsCount > 0)
        {
            throw new BadRequestException($"لا يمكن حذف الفئة '{category.NameAr ?? category.Key}' لوجود {totalProductsCount} منتج مرتبط بها (بما في ذلك المنتجات المؤرشفة). يرجى إلغاء تفعيل الفئة بدلاً من حذفها.");
        }

        _uow.Categories.Remove(category);
        await _uow.SaveChangesAsync();

        // Write AdminAuditLog row
        var audit = new AdminAuditLog
        {
            AdminId = adminId,
            Action = "DeleteCategory",
            EntityType = "Category",
            EntityId = id.ToString(),
            Details = $"Deleted category #{id} '{category.Key}'",
            CreatedAt = DateTime.UtcNow
        };
        await _uow.AdminAuditLogs.AddAsync(audit);
        await _uow.SaveChangesAsync();

        return true;
    }
}
