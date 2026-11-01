using System.ComponentModel.DataAnnotations.Schema;

namespace Marketplace.Domain.Entities;

public class Category
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string IconName { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; } = 0;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}
