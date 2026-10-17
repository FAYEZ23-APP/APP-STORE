using Marketplace.Application.DTOs.Categories;

namespace Marketplace.Application.Interfaces;

public interface ICategoryService
{
    Task<IEnumerable<CategoryResponse>> GetAllCategoriesAsync();
}
