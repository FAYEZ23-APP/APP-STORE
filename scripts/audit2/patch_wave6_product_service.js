const fs = require('fs');
const path = require('path');

const prodServicePath = path.join(__dirname, '../../backend/Marketplace.Application/Services/ProductService.cs');
let content = fs.readFileSync(prodServicePath, 'utf8');

if (!content.includes('BulkUploadProductsAsync')) {
    const methods = `
    public byte[] GenerateBulkUploadTemplate()
    {
        var csv = "Name,Description,Category,Price,OldPrice,Stock,DispatchCity,AllowInspection,Sku,VariantColor,VariantSize\\r\\n" +
                  "\\\"قميص كاجوال كلاسيكي\\\",\\\"قميص قطني مريح عالي الجودة مصنوع من القطن المصري\\\",\\\"ملابس\\\",350.00,450.00,20,\\\"القاهرة\\\",true,\\\"SHIRT-BLU-L\\\",\\\"أزرق\\\",\\\"L\\\"\\r\\n";
        
        // Include UTF-8 BOM so Excel opens Arabic correctly
        var preamble = System.Text.Encoding.UTF8.GetPreamble();
        var bytes = System.Text.Encoding.UTF8.GetBytes(csv);
        var result = new byte[preamble.Length + bytes.Length];
        Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
        Buffer.BlockCopy(bytes, 0, result, preamble.Length, bytes.Length);
        return result;
    }

    public async Task<BulkProductUploadReportDto> BulkUploadProductsAsync(int sellerId, System.IO.Stream csvStream)
    {
        var report = new BulkProductUploadReportDto();
        using var reader = new System.IO.StreamReader(csvStream, System.Text.Encoding.UTF8);

        var headerLine = await reader.ReadLineAsync();
        if (string.IsNullOrWhiteSpace(headerLine))
        {
            report.Errors.Add("ملف CSV فارغ.");
            return report;
        }

        var categories = (await _uow.Categories.GetAllAsync()).ToList();
        var defaultCategory = categories.FirstOrDefault(c => c.IsActive) ?? categories.FirstOrDefault();
        if (defaultCategory == null)
        {
            report.Errors.Add("لا توجد أقسام متوفرة في النظام.");
            return report;
        }

        int rowNum = 1;
        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            rowNum++;
            if (string.IsNullOrWhiteSpace(line)) continue;

            report.TotalRows++;

            try
            {
                var fields = ParseCsvLine(line);
                if (fields.Count < 6)
                {
                    report.Errors.Add($"سطر {rowNum}: عدد الأعمدة غير مكتمل (مطلوب 6 أعمدة على الأقل).");
                    continue;
                }

                var name = fields[0].Trim();
                var description = fields.Count > 1 ? fields[1].Trim() : string.Empty;
                var categoryName = fields.Count > 2 ? fields[2].Trim() : string.Empty;
                var priceStr = fields.Count > 3 ? fields[3].Trim() : "0";
                var oldPriceStr = fields.Count > 4 ? fields[4].Trim() : "";
                var stockStr = fields.Count > 5 ? fields[5].Trim() : "0";
                var sku = fields.Count > 8 ? fields[8].Trim() : null;
                var variantColor = fields.Count > 9 ? fields[9].Trim() : null;
                var variantSize = fields.Count > 10 ? fields[10].Trim() : null;

                if (string.IsNullOrWhiteSpace(name))
                {
                    report.Errors.Add($"سطر {rowNum}: اسم المنتج مطلوب.");
                    continue;
                }

                if (!decimal.TryParse(priceStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var price) || price <= 0)
                {
                    report.Errors.Add($"سطر {rowNum}: السعر غير صحيح '{priceStr}'.");
                    continue;
                }

                decimal? oldPrice = null;
                if (!string.IsNullOrWhiteSpace(oldPriceStr) && decimal.TryParse(oldPriceStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedOldPrice))
                {
                    oldPrice = parsedOldPrice;
                }

                if (!int.TryParse(stockStr, out var stock) || stock < 0)
                {
                    report.Errors.Add($"سطر {rowNum}: كمية المخزون غير صحيحة '{stockStr}'.");
                    continue;
                }

                var matchedCategory = categories.FirstOrDefault(c =>
                    c.NameAr.Equals(categoryName, StringComparison.OrdinalIgnoreCase) ||
                    c.NameEn.Equals(categoryName, StringComparison.OrdinalIgnoreCase) ||
                    c.Key.Equals(categoryName, StringComparison.OrdinalIgnoreCase)) ?? defaultCategory;

                // Check existing product by SKU for this seller
                Product? existingProduct = null;
                if (!string.IsNullOrWhiteSpace(sku))
                {
                    var existingVariant = (await _uow.ProductVariants.FindAsync(v => v.Sku == sku)).FirstOrDefault();
                    if (existingVariant != null)
                    {
                        var prod = await _uow.Products.GetByIdAsync(existingVariant.ProductId);
                        if (prod != null && prod.SellerId == sellerId)
                        {
                            existingProduct = prod;
                            existingVariant.Stock = stock;
                            existingVariant.PriceOverride = price;
                            _uow.ProductVariants.Update(existingVariant);
                        }
                    }
                }

                if (existingProduct != null)
                {
                    existingProduct.Price = price;
                    existingProduct.OldPrice = oldPrice;
                    existingProduct.Stock = stock;
                    _uow.Products.Update(existingProduct);
                    report.UpdatedCount++;
                }
                else
                {
                    var newProduct = new Product
                    {
                        SellerId = sellerId,
                        CategoryId = matchedCategory.Id,
                        Name = name,
                        NameAr = name,
                        NameEn = name,
                        Description = string.IsNullOrWhiteSpace(description) ? name : description,
                        DescriptionAr = string.IsNullOrWhiteSpace(description) ? name : description,
                        DescriptionEn = string.IsNullOrWhiteSpace(description) ? name : description,
                        Price = price,
                        OldPrice = oldPrice,
                        Stock = stock,
                        WeightGrams = 500,
                        ImageUrls = new List<string>(),
                        AllowInspection = true,
                        CreatedAt = DateTime.UtcNow,
                        SearchVector = BuildSearchVector(name, description, matchedCategory.NameAr, matchedCategory.NameEn)
                    };

                    await _uow.Products.AddAsync(newProduct);
                    await _uow.SaveChangesAsync(); // generate newProduct.Id

                    if (!string.IsNullOrWhiteSpace(sku) || !string.IsNullOrWhiteSpace(variantColor) || !string.IsNullOrWhiteSpace(variantSize))
                    {
                        var variant = new ProductVariant
                        {
                            ProductId = newProduct.Id,
                            Sku = sku,
                            Color = variantColor,
                            Size = variantSize,
                            Stock = stock,
                            PriceOverride = price
                        };
                        await _uow.ProductVariants.AddAsync(variant);
                    }

                    report.InsertedCount++;
                }
            }
            catch (Exception ex)
            {
                report.Errors.Add($"سطر {rowNum}: حدث خطأ أثناء المعالجة: {ex.Message}");
            }
        }

        await _uow.SaveChangesAsync();
        return report;
    }

    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var current = new System.Text.StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '\"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '\"')
                {
                    current.Append('\"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }
        result.Add(current.ToString());
        return result;
    }
`;

    const lastClosingIndex = content.lastIndexOf('}');
    content = content.slice(0, lastClosingIndex) + methods + '\n' + content.slice(lastClosingIndex);
    fs.writeFileSync(prodServicePath, content, 'utf8');
    console.log('Patched ProductService.cs with bulk upload methods');
}
