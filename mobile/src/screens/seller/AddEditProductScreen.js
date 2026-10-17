import tw from 'twrnc';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  I18nManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { createProduct, updateProduct, uploadProductImage } from '../../api/productsApi';
import { getCategories } from '../../api/categoriesApi';
import { getMySellerProfile } from '../../api/usersApi';
import { getImageUrl } from '../../utils/imageUrl';
import { getCategoryIconName } from '../../utils/categoryIcons';
import { colors } from '../../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function AddEditProductScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const editingProduct = route.params?.product;

  const [name, setName] = useState(editingProduct?.name || '');
  const [description, setDescription] = useState(editingProduct?.description || '');
  const [price, setPrice] = useState(editingProduct?.price?.toString() || '');
  const [oldPrice, setOldPrice] = useState(
    editingProduct?.oldPrice != null ? editingProduct.oldPrice.toString() : ''
  );
  const [stock, setStock] = useState(editingProduct?.stock?.toString() || '');
  const [weightGrams, setWeightGrams] = useState(
    editingProduct?.weightGrams != null ? editingProduct.weightGrams.toString() : ''
  );

  // Product Variants State
  const [variants, setVariants] = useState(
    Array.isArray(editingProduct?.variants) ? editingProduct.variants : []
  );
  const [newVariantSize, setNewVariantSize] = useState('');
  const [newVariantColor, setNewVariantColor] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('');
  const [newVariantSku, setNewVariantSku] = useState('');
  const [showAddVariant, setShowAddVariant] = useState(false);

  const handleAddVariant = () => {
    if (!newVariantSize.trim() && !newVariantColor.trim()) {
      Alert.alert(t('seller.variantAlertTitle'), t('seller.variantReqAlert'));
      return;
    }
    const st = parseInt(newVariantStock, 10);
    if (isNaN(st) || st < 0) {
      Alert.alert(t('seller.variantAlertTitle'), t('seller.variantStockAlert'));
      return;
    }
    const pr = newVariantPrice.trim() ? parseFloat(newVariantPrice) : null;
    if (pr !== null && (isNaN(pr) || pr <= 0)) {
      Alert.alert(t('seller.variantAlertTitle'), t('seller.variantPriceAlert'));
      return;
    }

    const newV = {
      sku: newVariantSku.trim() || null,
      size: newVariantSize.trim() || null,
      color: newVariantColor.trim() || null,
      priceOverride: pr,
      stock: st,
    };

    setVariants((prev) => [...prev, newV]);
    setNewVariantSize('');
    setNewVariantColor('');
    setNewVariantPrice('');
    setNewVariantStock('');
    setNewVariantSku('');
    setShowAddVariant(false);
  };

  const handleRemoveVariant = (index) => {
    setVariants((prev) => prev.filter((_, idx) => idx !== index));
  };

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(
    editingProduct?.categoryKey || null
  );

  const initialImage = editingProduct?.imageUrls?.[0] || null;
  const [imageUri, setImageUri] = useState(initialImage);
  const [relativeImageUrl, setRelativeImageUrl] = useState(initialImage);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dispatchCityChecked, setDispatchCityChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Check seller dispatch profile
    const verifySellerProfile = async () => {
      try {
        const res = await getMySellerProfile();
        if (isMounted) {
          if (!res?.data?.dispatchCity) {
            Alert.alert(
              t('seller.dispatchAlertTitle'),
              t('seller.dispatchAlertMsg'),
              [
                {
                  text: t('common.cancel'),
                  style: 'cancel',
                  onPress: () => {
                    if (navigation.canGoBack()) {
                      navigation.goBack();
                    }
                  },
                },
                {
                  text: t('seller.goToProfile'),
                  onPress: () => navigation.navigate('SellerRoot', { screen: 'Profile' }),
                },
              ]
            );
          }
          setDispatchCityChecked(true);
        }
      } catch (e) {
        if (isMounted) setDispatchCityChecked(true);
      }
    };

    const fetchCategoriesList = async () => {
      try {
        setLoadingCategories(true);
        const res = await getCategories();
        const fetched = Array.isArray(res.data) ? res.data : [];
        if (!isMounted) return;
        setCategories(fetched);

        if (editingProduct) {
          if (editingProduct.categoryKey) {
            setSelectedCategoryKey(editingProduct.categoryKey);
          } else if (editingProduct.categoryId) {
            const matched = fetched.find((c) => c.id === editingProduct.categoryId);
            if (matched) setSelectedCategoryKey(matched.key);
          }
        }
      } catch (err) {
        console.error('Failed to load categories', err);
        if (isMounted) {
          Alert.alert(t('common.error'), t('seller.loadCategoriesError'));
        }
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    };

    verifySellerProfile();
    fetchCategoriesList();
    return () => {
      isMounted = false;
    };
  }, [editingProduct, t, navigation]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        await handleUpload(asset);
      }
    } catch (err) {
      console.error('Image picker error', err);
      Alert.alert(t('common.error'), t('seller.imagePickerError'));
    }
  };

  const handleUpload = async (asset) => {
    setUploadingImage(true);
    try {
      const uri = asset.uri;
      const uriParts = uri.split('.');
      const extension = uriParts[uriParts.length - 1]?.toLowerCase() || 'jpg';
      const fileName = asset.fileName || `product_${Date.now()}.${extension}`;
      const mimeType = asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName,
        type: mimeType,
      });

      const res = await uploadProductImage(formData);
      if (res.data?.url) {
        setRelativeImageUrl(res.data.url);
      }
    } catch (err) {
      console.error('Image upload failed', err);
      Alert.alert(t('common.error'), err.response?.data?.error || t('seller.uploadImageFailed'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || !price || !stock || !weightGrams.trim()) {
      Alert.alert(t('common.error'), t('common.fillAllFields'));
      return;
    }

    const parsedWeight = parseInt(weightGrams, 10);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      Alert.alert(t('common.error'), t('seller.weightAlert'));
      return;
    }

    const selectedCategory = categories.find((c) => c.key === selectedCategoryKey);
    if (!selectedCategory) {
      Alert.alert(t('common.error'), t('seller.selectCategory'));
      return;
    }

    if (uploadingImage) {
      Alert.alert(t('common.error'), t('seller.uploading'));
      return;
    }

    const parsedPrice = parseFloat(price);
    const parsedOldPrice = oldPrice.trim() ? parseFloat(oldPrice) : null;

    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice,
        oldPrice: parsedOldPrice,
        stock: parseInt(stock, 10),
        weightGrams: parsedWeight,
        imageUrls: relativeImageUrl ? [relativeImageUrl] : [],
        categoryId: selectedCategory.id,
        variants: variants.length > 0 ? variants.map((v) => ({
          sku: v.sku || null,
          size: v.size || null,
          color: v.color || null,
          priceOverride: v.priceOverride || null,
          stock: v.stock || 0,
          imageUrl: v.imageUrl || null,
        })) : null,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, data);
      } else {
        await createProduct(data);
      }
      navigation.goBack();
    } catch (err) {
      const errData = err.response?.data;
      const validationMsg = errData?.errors
        ? Object.values(errData.errors).flat().join('\n')
        : null;
      Alert.alert(t('common.error'), validationMsg || errData?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[tw`flex-1`, { backgroundColor: colors.cardBg }]}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[tw`text-2xl font-bold mb-4`, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
        {editingProduct ? t('common.edit') : t('seller.addProduct')}
      </Text>

      <TouchableOpacity
        onPress={pickImage}
        disabled={uploadingImage}
        style={[
          tw`items-center justify-center rounded-xl h-44 overflow-hidden border mb-4`,
          {
            backgroundColor: colors.placeholderBg,
            borderColor: colors.border,
          },
        ]}
      >
        {imageUri ? (
          <View style={tw`w-full h-full relative`}>
            <Image
              source={{ uri: getImageUrl(imageUri) }}
              style={tw`w-full h-full`}
              resizeMode="cover"
            />
            {uploadingImage && (
              <View style={tw`absolute inset-0 bg-black/40 justify-center items-center`}>
                <ActivityIndicator size="large" color={colors.white} />
                <Text style={[tw`font-semibold mt-2`, { color: colors.white }]}>
                  {t('seller.uploading')}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={tw`items-center`}>
            <MaterialCommunityIcons name="camera-plus-outline" size={34} color={colors.textSecondary} />
            <Text style={[tw`font-medium mt-2`, { color: colors.textSecondary }]}>
              {t('seller.pickImage')}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Category Selector */}
      <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
        {t('seller.category')}
      </Text>
      {loadingCategories ? (
        <View style={{ paddingVertical: 12, marginBottom: 16, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
          contentContainerStyle={{ paddingVertical: 4 }}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategoryKey === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setSelectedCategoryKey(cat.key)}
                style={[
                  tw`flex-row items-center rounded-full border mr-2`,
                  {
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    backgroundColor: isSelected ? colors.primary : colors.screenBg,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={getCategoryIconName(cat.key)}
                  size={18}
                  color={isSelected ? colors.white : colors.textPrimary}
                />
                <Text
                  style={[
                    tw`font-medium text-sm ml-1.5`,
                    { color: isSelected ? colors.white : colors.textPrimary },
                  ]}
                >
                  {t(`categories.${cat.key}`, { defaultValue: cat.key })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Product Name */}
      <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
        {t('seller.productName')} *
      </Text>
      <TextInput
        style={[
          tw`w-full h-12 border rounded-xl px-4 mb-3`,
          { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
        ]}
        placeholder={t('seller.productName')}
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
      />

      {/* Product Description */}
      <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
        {t('seller.description')} *
      </Text>
      <TextInput
        style={[
          tw`w-full h-24 border rounded-xl px-4 py-3 mb-3`,
          { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
        ]}
        placeholder={t('seller.description')}
        placeholderTextColor={colors.textSecondary}
        multiline
        value={description}
        onChangeText={setDescription}
      />

      {/* Price & Old Price */}
      <View style={tw`flex-row justify-between mb-3`}>
        <View style={tw`flex-1 mr-1.5`}>
          <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('seller.priceCurrency', { currency: isRTL ? 'ج.م' : 'EGP' })}
          </Text>
          <TextInput
            style={[
              tw`w-full h-12 border rounded-xl px-4`,
              { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />
        </View>

        <View style={tw`flex-1 ml-1.5`}>
          <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('seller.oldPriceCurrency', { currency: isRTL ? 'ج.م' : 'EGP' })}
          </Text>
          <TextInput
            style={[
              tw`w-full h-12 border rounded-xl px-4`,
              { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={oldPrice}
            onChangeText={setOldPrice}
          />
        </View>
      </View>

      {/* Stock & Weight */}
      <View style={tw`flex-row justify-between mb-5`}>
        <View style={tw`flex-1 mr-1.5`}>
          <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('seller.stockUnit')}
          </Text>
          <TextInput
            style={[
              tw`w-full h-12 border rounded-xl px-4`,
              { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder={t('seller.stockPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={stock}
            onChangeText={setStock}
          />
        </View>

        <View style={tw`flex-1 ml-1.5`}>
          <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('seller.weightUnit')}
          </Text>
          <TextInput
            style={[
              tw`w-full h-12 border rounded-xl px-4`,
              { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder={t('seller.weightGramsPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={weightGrams}
            onChangeText={setWeightGrams}
          />
        </View>
      </View>

      {/* Product Variants (Size, Color, Specs) Section */}
      <View
        style={[
          tw`rounded-2xl p-4 mb-5 border`,
          { backgroundColor: colors.screenBg, borderColor: colors.border },
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <View style={tw`flex-row items-center flex-1 mr-2`}>
            <MaterialCommunityIcons
              name="layers-outline"
              size={20}
              color={colors.accent}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                tw`font-bold text-sm`,
                { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
              ]}
            >
              {t('seller.variantTitle')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddVariant(!showAddVariant)}
            style={[
              tw`px-3 py-1.5 rounded-full flex-row items-center border`,
              {
                backgroundColor: showAddVariant ? colors.cardBg : colors.accent,
                borderColor: colors.accent,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={showAddVariant ? 'close' : 'plus'}
              size={14}
              color={showAddVariant ? colors.accent : colors.white}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                tw`text-xs font-bold`,
                { color: showAddVariant ? colors.accent : colors.white },
              ]}
            >
              {showAddVariant ? t('seller.cancelAddVariant') : t('seller.addVariant')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[tw`text-xs mb-3`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('seller.variantSubtitle')}
        </Text>

        {/* Existing Variants List */}
        {variants.length > 0 ? (
          <View style={tw`mb-3`}>
            {variants.map((v, idx) => {
              const summaryParts = [];
              if (v.size) summaryParts.push(`${t('seller.sizePrefix')} ${v.size}`);
              if (v.color) summaryParts.push(`${t('seller.colorPrefix')} ${v.color}`);
              if (v.sku) summaryParts.push(`SKU: ${v.sku}`);
              const summary = summaryParts.join(' | ') || `${t('seller.optionDefault')} #${idx + 1}`;
              const priceDisplay = v.priceOverride
                ? `${v.priceOverride} ${isRTL ? 'ج.م' : 'EGP'}`
                : t('seller.sameBasePrice');

              return (
                <View
                  key={idx}
                  style={[
                    tw`flex-row items-center justify-between p-3 rounded-xl mb-2 border`,
                    { backgroundColor: colors.cardBg, borderColor: colors.border },
                  ]}
                >
                  <View style={tw`flex-1 mr-2`}>
                    <Text style={[tw`font-bold text-sm`, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
                      {summary}
                    </Text>
                    <View style={tw`flex-row items-center mt-1`}>
                      <Text style={[tw`text-xs font-semibold mr-3`, { color: colors.accent }]}>
                        {priceDisplay}
                      </Text>
                      <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>
                        {t('seller.stockPieces', { count: v.stock })}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveVariant(idx)}
                    style={tw`p-2 rounded-full bg-red-50`}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          !showAddVariant && (
            <Text style={[tw`text-xs italic py-2 text-center`, { color: colors.textSecondary }]}>
              {t('seller.noVariants')}
            </Text>
          )
        )}

        {/* Add Variant Form */}
        {showAddVariant && (
          <View
            style={[
              tw`p-3 rounded-xl border mt-1`,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <Text style={[tw`font-bold text-xs mb-2`, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('seller.newVariantData')}
            </Text>

            <View style={tw`flex-row justify-between mb-2`}>
              <View style={tw`flex-1 mr-1`}>
                <Text style={[tw`text-[11px] font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('seller.variantSize')}
                </Text>
                <TextInput
                  style={[
                    tw`w-full h-10 border rounded-lg px-3 text-xs`,
                    { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
                  ]}
                  placeholder={t('seller.variantSizePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={newVariantSize}
                  onChangeText={setNewVariantSize}
                />
              </View>

              <View style={tw`flex-1 ml-1`}>
                <Text style={[tw`text-[11px] font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('seller.variantColor')}
                </Text>
                <TextInput
                  style={[
                    tw`w-full h-10 border rounded-lg px-3 text-xs`,
                    { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
                  ]}
                  placeholder={t('seller.variantColorPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={newVariantColor}
                  onChangeText={setNewVariantColor}
                />
              </View>
            </View>

            <View style={tw`flex-row justify-between mb-2`}>
              <View style={tw`flex-1 mr-1`}>
                <Text style={[tw`text-[11px] font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('seller.variantStock')}
                </Text>
                <TextInput
                  style={[
                    tw`w-full h-10 border rounded-lg px-3 text-xs`,
                    { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
                  ]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={newVariantStock}
                  onChangeText={setNewVariantStock}
                />
              </View>

              <View style={tw`flex-1 ml-1`}>
                <Text style={[tw`text-[11px] font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('seller.variantPrice', { currency: isRTL ? 'ج.م' : 'EGP' })}
                </Text>
                <TextInput
                  style={[
                    tw`w-full h-10 border rounded-lg px-3 text-xs`,
                    { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
                  ]}
                  placeholder={t('seller.sameBasePrice')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={newVariantPrice}
                  onChangeText={setNewVariantPrice}
                />
              </View>
            </View>

            <View style={tw`mb-3`}>
              <Text style={[tw`text-[11px] font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('seller.variantSku')}
              </Text>
              <TextInput
                style={[
                  tw`w-full h-10 border rounded-lg px-3 text-xs`,
                  { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
                ]}
                placeholder={t('seller.skuPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={newVariantSku}
                onChangeText={setNewVariantSku}
              />
            </View>

            <View style={tw`flex-row justify-end`}>
              <TouchableOpacity
                onPress={() => setShowAddVariant(false)}
                style={[tw`px-3 py-2 rounded-lg border mr-2`, { borderColor: colors.border }]}
              >
                <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                  {t('seller.cancelAddVariant')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddVariant}
                style={[tw`px-4 py-2 rounded-lg`, { backgroundColor: colors.accent }]}
              >
                <Text style={[tw`text-xs font-bold`, { color: colors.white }]}>
                  {t('seller.saveVariant')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={{ borderRadius: 14, overflow: 'hidden', marginTop: 8 }}
        onPress={handleSave}
        disabled={loading || uploadingImage || loadingCategories}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={
            loading || uploadingImage || loadingCategories
              ? [colors.disabledBg, colors.disabledBg]
              : [colors.accent, '#FF8C33']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            tw`w-full flex-row items-center justify-center`,
            { minHeight: 52 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save-outline" size={20} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={[tw`text-base font-bold`, { color: colors.white }]}>
                {t('common.save')}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}
