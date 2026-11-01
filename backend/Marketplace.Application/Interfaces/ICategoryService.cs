using Marketplace.Application.DTOs.Categories;

namespace Marketplace.Application.Interfaces;

public interface ICategoryService
{
    Task<IEnumerable<CategoryResponse>> GetAllCategoriesAsync(bool includeInactive = false);
    Task<CategoryResponse> GetCategoryByIdAsync(int id);
    Task<CategoryResponse> CreateCategoryAsync(CreateCategoryRequest request, int? adminId = null);
    Task<CategoryResponse> UpdateCategoryAsync(int id, UpdateCategoryRequest request, int? adminId = null);
    Task<bool> DeleteCategoryAsync(int id, int? adminId = null);
}
