namespace Marketplace.Domain.Entities;

public class Category
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string IconName { get; set; } = string.Empty;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}
