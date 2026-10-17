using Marketplace.Application.DTOs.Categories;
using Marketplace.Application.Interfaces;

namespace Marketplace.Application.Services;

public class CategoryService : ICategoryService
{
    private readonly IUnitOfWork _uow;

    public CategoryService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<IEnumerable<CategoryResponse>> GetAllCategoriesAsync()
    {
        var categories = await _uow.Categories.GetAllAsync();
        return categories.Select(c => new CategoryResponse
        {
            Id = c.Id,
            Key = c.Key,
            IconName = c.IconName
        });
    }
}
