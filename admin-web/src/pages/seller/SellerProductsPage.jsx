import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Upload,
  X,
  AlertCircle,
  CheckCircle,
  Tag,
  Scale,
  RotateCcw,
} from 'lucide-react';
import {
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} from '../../api/productsApi';
import { getCategories } from '../../api/categoriesApi';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl, handleImageError } from '../../utils/imageUrl';

export default function SellerProductsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [weightGrams, setWeightGrams] = useState('500');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [allowInspection, setAllowInspection] = useState(true);
  const [variants, setVariants] = useState([]);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchSellerProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyProducts();
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load seller products', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerProducts();
    getCategories()
      .then((res) => {
        if (Array.isArray(res.data)) {
          setCategories(res.data);
          if (res.data.length > 0) setCategoryId(res.data[0].id);
        }
      })
      .catch((e) => console.warn('Failed to load categories', e));
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setPrice('');
    setOldPrice('');
    setStock('10');
    setWeightGrams('500');
    if (categories.length > 0) setCategoryId(categories[0].id);
    setImageUrls([]);
    setAllowInspection(true);
    setVariants([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setName(p.name || '');
    setDescription(p.description || '');
    setPrice(String(p.price || ''));
    setOldPrice(p.oldPrice != null ? String(p.oldPrice) : '');
    setStock(String(p.stock != null ? p.stock : '10'));
    setWeightGrams(String(p.weightGrams != null ? p.weightGrams : '500'));
    setCategoryId(p.categoryId || (categories[0]?.id ?? ''));
    setImageUrls(Array.isArray(p.imageUrls) ? [...p.imageUrls] : []);
    setAllowInspection(p.allowInspection !== false);
    setVariants(Array.isArray(p.variants) ? p.variants.map((v) => ({
      id: v.id,
      sku: v.sku || '',
      size: v.size || '',
      color: v.color || '',
      stock: v.stock != null ? String(v.stock) : '10',
      priceOverride: v.priceOverride != null ? String(v.priceOverride) : '',
    })) : []);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleImageFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingImage(true);
    setFormError(null);

    try {
      for (const file of files) {
        // Validate file type
        const validExtensions = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validExtensions.includes(file.type)) {
          throw new Error(isRTL ? 'يرجى رفع صور بصيغة JPG أو PNG أو WEBP فقط' : 'Only JPG, PNG, WEBP images allowed');
        }

        const formData = new FormData();
        formData.append('file', file);
        const res = await uploadProductImage(formData);
        if (res.data?.url) {
          setImageUrls((prev) => [...prev, res.data.url]);
        }
      }
    } catch (err) {
      console.error('Image upload failed', err);
      setFormError(err?.message || (isRTL ? 'فشل رفع الصورة' : 'Image upload failed'));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddVariant = () => {
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

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (formSaving) return;
    setFormError(null);

    if (!name.trim() || !price || !stock || !weightGrams) {
      setFormError(t('common.fillAllFields'));
      return;
    }

    const parsedPrice = parseFloat(price);
    const parsedOldPrice = oldPrice.trim() ? parseFloat(oldPrice) : null;
    const parsedStock = parseInt(stock, 10);
    const parsedWeight = parseInt(weightGrams, 10);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError(isRTL ? 'يرجى إدخال سعر صحيح أكبر من الصفر' : 'Price must be positive');
      return;
    }

    if (isNaN(parsedStock) || parsedStock < 0) {
      setFormError(isRTL ? 'يرجى إدخال كمية مخزون صحيحة' : 'Invalid stock quantity');
      return;
    }

    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      setFormError(isRTL ? 'يرجى إدخال وزن المنتج بالجرام' : 'Invalid product weight');
      return;
    }

    setFormSaving(true);

    const payload = {
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
    };

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
      } else {
        await createProduct(payload);
      }
      setIsModalOpen(false);
      await fetchSellerProducts();
    } catch (err) {
      console.error('Save product failed', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error');
      setFormError(msg);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من رغبتك في حذف هذا المنتج؟' : 'Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await deleteProduct(id);
      await fetchSellerProducts();
    } catch (err) {
      alert(t('common.error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="font-extrabold text-slate-900 text-sm">
            {t('seller.myProducts')} ({products.length})
          </h2>
          <p className="text-[11px] text-slate-500">
            {isRTL ? 'إدارة السلع وتحديث المخزون والأسعار بالجنيه المصري' : 'Manage items, stock counts, and prices in EGP'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSellerProducts}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            title={t('common.refresh')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t('seller.addProduct')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Products Table / Cards */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">{t('common.loading')}</div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4 shadow-sm">
          <Package className="w-16 h-16 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">
            {t('seller.noProducts')}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isRTL
              ? 'ابدأ الآن بإضافة منتجاتك وصورها وحدد أسعارها لتظهر لآلاف المشترين في منصة مصر.'
              : 'Add your first product to start selling on Egyptian Marketplace.'}
          </p>
          <button
            onClick={openCreateModal}
            className="px-6 py-2.5 bg-orange-500 text-white font-bold text-xs rounded-xl shadow-md"
          >
            {t('seller.addProduct')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 text-start">{isRTL ? 'المنتج' : 'Product'}</th>
                  <th className="py-3.5 px-4 text-start">{t('seller.category')}</th>
                  <th className="py-3.5 px-4 text-start">{t('seller.price')}</th>
                  <th className="py-3.5 px-4 text-start">{t('seller.stock')}</th>
                  <th className="py-3.5 px-4 text-start">{t('product.weight')}</th>
                  <th className="py-3.5 px-4 text-center">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const img = p.imageUrls?.[0] ? getImageUrl(p.imageUrls[0]) : null;
                  const isLow = p.stock > 0 && p.stock <= 5;
                  const isOut = p.stock <= 0;

                  return (
                    <tr key={`seller-prod-${p.id}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {img ? (
                              <img
                                src={img}
                                alt=""
                                onError={handleImageError}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-slate-300" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block line-clamp-1 max-w-xs">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: #{p.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {p.categoryName || '-'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{formatCurrency(p.price)}</span>
                        {p.oldPrice && (
                          <span className="block text-[11px] text-slate-400 line-through">
                            {formatCurrency(p.oldPrice)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block font-bold px-2 py-0.5 rounded text-[11px] ${
                            isOut
                              ? 'bg-red-100 text-red-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.stock} {isRTL ? 'قطعة' : 'units'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {p.weightGrams ? `${p.weightGrams} ${isRTL ? 'جرام' : 'g'}` : '-'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('common.edit')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-label="إدارة المنتج / Product Modal" className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">
                {editingProduct
                  ? isRTL ? `تعديل المنتج #${editingProduct.id}` : `Edit Product #${editingProduct.id}`
                  : t('seller.addProduct')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-800 p-3 rounded-xl text-xs font-semibold border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('seller.productName')} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isRTL ? 'مثال: ساعة يد ذكية مقاومة للماء' : 'e.g. Smart Waterproof Watch'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('seller.category')} *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none bg-white"
                  >
                    {categories.map((c) => (
                      <option key={`cat-opt-${c.id}`} value={c.id}>
                        {isRTL ? c.nameAr || c.name : c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('seller.weightGrams')} *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(e.target.value)}
                    placeholder="500"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('seller.price')} *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="299"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('seller.oldPrice')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={oldPrice}
                    onChange={(e) => setOldPrice(e.target.value)}
                    placeholder="399"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('seller.stock')} *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="10"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('seller.description')}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('seller.description')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none"
                ></textarea>
              </div>

              {/* Allow Inspection Checkbox (GAP-BUY-01) */}
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

              {/* Real Multi-Image Uploader */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  {t('seller.imageUrls')} (JPG, PNG, WEBP):
                </label>

                {/* Upload Trigger */}
                <label className="border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 hover:bg-orange-50/20">
                  <Upload className="w-6 h-6 text-orange-500 mb-1" />
                  <span className="text-xs font-bold text-slate-700">
                    {uploadingImage
                      ? t('seller.uploading')
                      : (isRTL ? 'انقر لاختيار صور من جهازك' : 'Click to select image files')}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {isRTL ? 'الحد الأقصى 5 ميجابايت لكل صورة' : 'Max 5MB per image'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={uploadingImage}
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </label>

                {/* Image Previews */}
                {imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {imageUrls.map((url, idx) => {
                      const resolvedUrl = getImageUrl(url);
                      return (
                        <div
                          key={`img-preview-${idx}`}
                          className="relative w-20 h-20 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 group"
                        >
                          <img
                            src={resolvedUrl}
                            alt=""
                            onError={handleImageError}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 end-1 bg-red-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={formSaving || uploadingImage}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {formSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
