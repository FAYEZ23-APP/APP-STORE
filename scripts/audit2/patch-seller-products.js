const fs = require('fs');
const path = require('path');

const filePath = path.resolve('admin-web/src/pages/seller/SellerProductsPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add allowInspection and variants state
const stateTarget = "  const [imageUrls, setImageUrls] = useState([]);";
const stateReplacement = `  const [imageUrls, setImageUrls] = useState([]);
  const [allowInspection, setAllowInspection] = useState(true);
  const [variants, setVariants] = useState([]);`;
content = content.replace(stateTarget, stateReplacement);

// 2. Reset in openCreateModal
const createTarget = "    setImageUrls([]);\n    setFormError(null);";
const createReplacement = `    setImageUrls([]);
    setAllowInspection(true);
    setVariants([]);
    setFormError(null);`;
content = content.replace(createTarget, createReplacement);

// 3. Load in openEditModal
const editTarget = "    setImageUrls(Array.isArray(p.imageUrls) ? [...p.imageUrls] : []);\n    setFormError(null);";
const editReplacement = `    setImageUrls(Array.isArray(p.imageUrls) ? [...p.imageUrls] : []);
    setAllowInspection(p.allowInspection !== false);
    setVariants(Array.isArray(p.variants) ? p.variants.map((v) => ({
      id: v.id,
      sku: v.sku || '',
      size: v.size || '',
      color: v.color || '',
      stock: v.stock != null ? String(v.stock) : '10',
      priceOverride: v.priceOverride != null ? String(v.priceOverride) : '',
    })) : []);
    setFormError(null);`;
content = content.replace(editTarget, editReplacement);

// 4. Add variant helper functions before handleSaveProduct
const saveTarget = "  const handleSaveProduct = async (e) => {";
const helpersAndSave = `  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      { sku: '', size: '', color: '', stock: '10', priceOverride: '' },
    ]);
  };

  const handleUpdateVariant = (index, field, value) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveVariant = (index) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async (e) => {`;
content = content.replace(saveTarget, helpersAndSave);

// 5. Update payload in handleSaveProduct
const payloadTarget = `    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: parsedPrice,
      oldPrice: parsedOldPrice,
      stock: parsedStock,
      weightGrams: parsedWeight,
      categoryId: parseInt(categoryId, 10),
      imageUrls: imageUrls,
    };`;

const payloadReplacement = `    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: parsedPrice,
      oldPrice: parsedOldPrice,
      stock: parsedStock,
      weightGrams: parsedWeight,
      categoryId: parseInt(categoryId, 10),
      imageUrls: imageUrls,
      allowInspection: allowInspection,
      variants: variants.map((v) => ({
        id: v.id || undefined,
        sku: v.sku.trim() || undefined,
        size: v.size.trim() || undefined,
        color: v.color.trim() || undefined,
        stock: parseInt(v.stock, 10) || 0,
        priceOverride: v.priceOverride ? parseFloat(v.priceOverride) : null,
      })),
    };`;
content = content.replace(payloadTarget, payloadReplacement);

// 6. Add inspection checkbox and variants editor in form UI before image uploader
const formTarget = "              {/* Real Multi-Image Uploader */}";
const formAdditions = `              {/* Allow Inspection Checkbox (GAP-BUY-01) */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-900">
                    {isRTL ? 'معاينة الطرد عند الاستلام أمام المندوب' : 'Open-Box Inspection Allowed'}
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    {isRTL
                      ? 'السماح للعميل بفتح الشحنة وفحص المنتج قبل سداد قيمة الدفع عند الاستلام (يرفع نسبة نجاح التسليم بنسبة 40%)'
                      : 'Allow buyer to inspect the package at the doorstep before paying.'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowInspection}
                  onChange={(e) => setAllowInspection(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500"
                />
              </div>

              {/* Product Variants Management (GAP-SEL-02) */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      {isRTL ? 'مقاسات وألوان وخصائص المنتج (Product Variants)' : 'Product Variants (Sizes & Colors)'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {isRTL
                        ? 'أضف المقاسات أو الألوان مع المخزون الخاص وسعر التخفيض إن وجد'
                        : 'Define variants with dedicated stock and optional price override.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'إضافة خيار' : 'Add Variant'}</span>
                  </button>
                </div>

                {variants.length === 0 ? (
                  <div className="text-center py-3 text-slate-400 text-xs font-medium">
                    {isRTL ? 'لا توجد خيارات إضافية للمنتج (يعتمد على السعر والمخزون الأساسي)' : 'No variants defined (uses base price & stock)'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {variants.map((v, idx) => (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 items-center text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{isRTL ? 'المقاس' : 'Size'}</label>
                          <input
                            type="text"
                            value={v.size}
                            onChange={(e) => handleUpdateVariant(idx, 'size', e.target.value)}
                            placeholder="e.g. XL, 42"
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{isRTL ? 'اللون' : 'Color'}</label>
                          <input
                            type="text"
                            value={v.color}
                            onChange={(e) => handleUpdateVariant(idx, 'color', e.target.value)}
                            placeholder="e.g. أحمر, Red"
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">SKU</label>
                          <input
                            type="text"
                            value={v.sku}
                            onChange={(e) => handleUpdateVariant(idx, 'sku', e.target.value)}
                            placeholder="SKU-101"
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{isRTL ? 'المخزون' : 'Stock'}</label>
                          <input
                            type="number"
                            min="0"
                            value={v.stock}
                            onChange={(e) => handleUpdateVariant(idx, 'stock', e.target.value)}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{isRTL ? 'السعر البديل' : 'Price Override'}</label>
                          <input
                            type="number"
                            step="0.01"
                            value={v.priceOverride}
                            onChange={(e) => handleUpdateVariant(idx, 'priceOverride', e.target.value)}
                            placeholder="Optional"
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs"
                          />
                        </div>
                        <div className="flex justify-end pt-3 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(idx)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Real Multi-Image Uploader */}`;

content = content.replace(formTarget, formAdditions);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched SellerProductsPage.jsx');
