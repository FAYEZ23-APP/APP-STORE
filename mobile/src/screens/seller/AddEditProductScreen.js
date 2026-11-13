import tw from 'twrnc';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { createProduct, updateProduct, uploadProductImage } from '../../api/productsApi';
import { getCategories } from '../../api/categoriesApi';
import { getMySellerProfile } from '../../api/usersApi';
import { getImageUrl } from '../../utils/imageUrl';
import { getCategoryIconName } from '../../utils/categoryIcons';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import AnimatedPressable from '../../components/common/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const MAX_IMAGES = 8;
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_COMPRESS_QUALITY = 0.8;

export default function AddEditProductScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = i18n.language?.startsWith('ar');
  const editingProduct = route.params?.product;
  const isMountedRef = useRef(true);
  const safeBottom = Math.max(insets.bottom, 16) + 36;

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

  // Ordered product images state (up to 8 images)
  const [images, setImages] = useState(() => {
    const initialUrls = Array.isArray(editingProduct?.imageUrls)
      ? editingProduct.imageUrls.slice(0, MAX_IMAGES)
      : [];
    return initialUrls.map((url, idx) => ({
      id: `existing_${idx}_${Date.now()}`,
      localUri: url,
      remoteUrl: url,
      asset: null,
      status: 'uploaded', // 'uploading' | 'uploaded' | 'error'
      progress: 100,
      errorMsg: null,
    }));
  });

  const [loading, setLoading] = useState(false);
  const [, setDispatchCityChecked] = useState(false);

  const anyUploading = images.some((img) => img.status === 'uploading');

  useEffect(() => {
    isMountedRef.current = true;

    // Check seller dispatch profile
    const verifySellerProfile = async () => {
      try {
        const res = await getMySellerProfile();
        if (isMountedRef.current) {
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
      } catch {
        if (isMountedRef.current) setDispatchCityChecked(true);
      }
    };

    const fetchCategoriesList = async () => {
      try {
        setLoadingCategories(true);
        const res = await getCategories();
        const fetched = Array.isArray(res.data) ? res.data : [];
        if (!isMountedRef.current) return;
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
        if (isMountedRef.current) {
          Alert.alert(t('common.error'), t('seller.loadCategoriesError'));
        }
      } finally {
        if (isMountedRef.current) setLoadingCategories(false);
      }
    };

    verifySellerProfile();
    fetchCategoriesList();
    return () => {
      isMountedRef.current = false;
    };
  }, [editingProduct, t, navigation]);

  const updateImageItem = (id, patch) => {
    if (!isMountedRef.current) return;
    setImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const resizeAndCompressImage = async (asset) => {
    const actions = [];
    const width = asset?.width || 0;
    const height = asset?.height || 0;

    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      if (width >= height) {
        actions.push({ resize: { width: MAX_IMAGE_DIMENSION } });
      } else {
        actions.push({ resize: { height: MAX_IMAGE_DIMENSION } });
      }
    }

    const manipulated = await manipulateAsync(
      asset.uri,
      actions,
      {
        compress: JPEG_COMPRESS_QUALITY,
        format: SaveFormat.JPEG,
      }
    );
    return manipulated.uri;
  };

  const processAndUploadItem = async (item) => {
    updateImageItem(item.id, {
      status: 'uploading',
      progress: 5,
      errorMsg: null,
    });

    try {
      let uploadUri = item.localUri;
      if (item.asset) {
        try {
          uploadUri = await resizeAndCompressImage(item.asset);
        } catch (manipErr) {
          console.warn('Image manipulation fallback to original URI', manipErr);
          uploadUri = item.asset.uri;
        }
      }

      if (!isMountedRef.current) return;
      updateImageItem(item.id, { localUri: uploadUri, progress: 15 });

      const fileName = `product_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri: uploadUri,
        name: fileName,
        type: 'image/jpeg',
      });

      const res = await uploadProductImage(formData, (progressEvent) => {
        if (!progressEvent || !progressEvent.total) return;
        const pct = Math.min(
          99,
          Math.max(15, Math.round((progressEvent.loaded * 100) / progressEvent.total))
        );
        updateImageItem(item.id, { progress: pct });
      });

      if (res.data?.url) {
        updateImageItem(item.id, {
          remoteUrl: res.data.url,
          status: 'uploaded',
          progress: 100,
          errorMsg: null,
        });
      } else {
        throw new Error(t('seller.uploadImageFailed'));
      }
    } catch (err) {
      console.error('Image upload failed', err);
      const msg = err.response?.data?.error || t('seller.uploadImageFailed');
      updateImageItem(item.id, {
        status: 'error',
        progress: 0,
        errorMsg: msg,
      });
    }
  };

  const pickImages = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert(t('common.error'), t('seller.maxImagesReached'));
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });

      if (!result.canceled && Array.isArray(result.assets) && result.assets.length > 0) {
        const selectedAssets = result.assets.slice(0, remaining);
        const now = Date.now();
        const newItems = selectedAssets.map((asset, idx) => ({
          id: `img_${now}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
          localUri: asset.uri,
          remoteUrl: null,
          asset,
          status: 'uploading',
          progress: 0,
          errorMsg: null,
        }));

        setImages((prev) => [...prev, ...newItems].slice(0, MAX_IMAGES));

        for (const item of newItems) {
          processAndUploadItem(item);
        }
      }
    } catch (err) {
      console.error('Image picker error', err);
      Alert.alert(t('common.error'), t('seller.imagePickerError'));
    }
  };

  const handleRetryUpload = (id) => {
    const target = images.find((img) => img.id === id);
    if (target) {
      processAndUploadItem(target);
    }
  };

  const handleRemoveImage = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleMakeMain = (index) => {
    if (index <= 0 || index >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const [chosen] = next.splice(index, 1);
      next.unshift(chosen);
      return next;
    });
  };

  const handleMoveImage = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
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

    if (images.some((img) => img.status === 'uploading')) {
      Alert.alert(t('common.error'), t('seller.waitForUploads'));
      return;
    }

    if (images.some((img) => img.status === 'error')) {
      Alert.alert(t('common.error'), t('seller.fixFailedUploads'));
      return;
    }

    const parsedPrice = parseFloat(price);
    const parsedOldPrice = oldPrice.trim() ? parseFloat(oldPrice) : null;
    const orderedImageUrls = images
      .map((img) => img.remoteUrl)
      .filter(Boolean)
      .slice(0, MAX_IMAGES);

    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice,
        oldPrice: parsedOldPrice,
        stock: parseInt(stock, 10),
        weightGrams: parsedWeight,
        imageUrls: orderedImageUrls,
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.cardBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[tw`flex-1`, { backgroundColor: colors.cardBg }]}
        contentContainerStyle={{ padding: 20, paddingBottom: safeBottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <Text style={[tw`text-2xl font-bold mb-4`, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
        {editingProduct ? t('common.edit') : t('seller.addProduct')}
      </Text>

      {/* Multi-Image Grid Section (up to 8 images) */}
      <View
        style={[
          tw`rounded-2xl p-3.5 mb-4 border`,
          { backgroundColor: colors.screenBg, borderColor: colors.border },
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-1`}>
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons
              name="image-multiple-outline"
              size={20}
              color={colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={[tw`text-sm font-bold`, { color: colors.textPrimary }]}>
              {t('seller.productImagesTitle')}
            </Text>
          </View>
          <View
            style={[
              tw`px-2.5 py-0.5 rounded-full`,
              { backgroundColor: images.length >= MAX_IMAGES ? colors.accent : colors.primary },
            ]}
          >
            <Text style={[tw`text-xs font-bold`, { color: colors.white }]}>
              {t('seller.imagesCounter', { count: images.length, max: MAX_IMAGES })}
            </Text>
          </View>
        </View>

        <Text
          style={[
            tw`text-xs mb-3`,
            { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {t('seller.productImagesHint')}
        </Text>

        <View style={tw`flex-row flex-wrap justify-between`}>
          {images.map((item, idx) => {
            const isMain = idx === 0;
            const previewUri = getImageUrl(item.remoteUrl || item.localUri) || item.localUri;

            return (
              <View
                key={item.id}
                style={[
                  tw`rounded-xl overflow-hidden border mb-3`,
                  {
                    width: '48.5%',
                    backgroundColor: colors.cardBg,
                    borderColor: isMain ? colors.accent : colors.border,
                    borderWidth: isMain ? 2 : 1,
                  },
                ]}
              >
                {/* Image Preview Box */}
                <View style={tw`w-full h-32 relative bg-gray-100`}>
                  <Image
                    source={{ uri: previewUri }}
                    style={tw`w-full h-full`}
                    resizeMode="cover"
                  />

                  {/* Top Badges: Main or Index + Remove button */}
                  <View style={tw`absolute top-1.5 left-1.5 right-1.5 flex-row items-center justify-between`}>
                    {isMain ? (
                      <View
                        style={[
                          tw`px-2 py-0.5 rounded-md flex-row items-center`,
                          { backgroundColor: colors.accent },
                        ]}
                      >
                        <MaterialCommunityIcons name="star" size={12} color={colors.white} />
                        <Text style={[tw`text-[10px] font-bold ml-1`, { color: colors.white }]}>
                          {t('seller.mainImageBadge')}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          tw`px-2 py-0.5 rounded-md`,
                          { backgroundColor: 'rgba(15,23,42,0.7)' },
                        ]}
                      >
                        <Text style={[tw`text-[10px] font-bold`, { color: colors.white }]}>
                          #{idx + 1}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      onPress={() => handleRemoveImage(item.id)}
                      style={[
                        tw`w-6 h-6 rounded-full items-center justify-center`,
                        { backgroundColor: 'rgba(220,38,38,0.9)' },
                      ]}
                      accessibilityLabel={t('seller.removeImage')}
                    >
                      <MaterialCommunityIcons name="close" size={14} color={colors.white} />
                    </TouchableOpacity>
                  </View>

                  {/* Uploading Progress Overlay */}
                  {item.status === 'uploading' && (
                    <View style={tw`absolute inset-0 bg-black/55 justify-center items-center px-3`}>
                      <ActivityIndicator size="small" color={colors.white} />
                      <Text style={[tw`text-xs font-bold mt-1`, { color: colors.white }]}>
                        {item.progress}%
                      </Text>
                      <View style={tw`w-full h-1.5 bg-white/30 rounded-full mt-1.5 overflow-hidden`}>
                        <View
                          style={[
                            tw`h-full rounded-full`,
                            {
                              width: `${item.progress}%`,
                              backgroundColor: colors.accent,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Failed Upload Overlay with Retry */}
                  {item.status === 'error' && (
                    <View style={tw`absolute inset-0 bg-red-900/80 justify-center items-center px-2`}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.white} />
                      <Text
                        numberOfLines={2}
                        style={[tw`text-[10px] text-center mt-0.5 mb-1.5`, { color: colors.white }]}
                      >
                        {item.errorMsg || t('seller.uploadImageFailed')}
                      </Text>
                      <TouchableOpacity accessible={true} accessibilityRole="button"
                        onPress={() => handleRetryUpload(item.id)}
                        style={[
                          tw`px-2.5 py-1 rounded-full flex-row items-center`,
                          { backgroundColor: colors.white },
                        ]}
                      >
                        <MaterialCommunityIcons name="refresh" size={13} color={colors.danger} />
                        <Text style={[tw`text-[11px] font-bold ml-1`, { color: colors.danger }]}>
                          {t('seller.retryUpload')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Controls Bar: Make Main, Move Up, Move Down */}
                <View
                  style={[
                    tw`flex-row items-center justify-between px-2 py-1.5 border-t`,
                    { borderColor: colors.border, backgroundColor: colors.cardBg },
                  ]}
                >
                  {!isMain ? (
                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      onPress={() => handleMakeMain(idx)}
                      style={[
                        tw`px-2 py-1 rounded-md flex-row items-center`,
                        { backgroundColor: colors.placeholderBg },
                      ]}
                    >
                      <MaterialCommunityIcons name="star-outline" size={13} color={colors.primary} />
                      <Text style={[tw`text-[10px] font-bold ml-1`, { color: colors.primary }]}>
                        {t('seller.makeMainImage')}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={tw`px-1 py-1 flex-row items-center`}>
                      <MaterialCommunityIcons name="check-decagram" size={13} color={colors.accent} />
                      <Text style={[tw`text-[10px] font-bold ml-1`, { color: colors.accent }]}>
                        {t('seller.mainImageBadge')}
                      </Text>
                    </View>
                  )}

                  <View style={tw`flex-row items-center`}>
                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      onPress={() => handleMoveImage(idx, -1)}
                      disabled={idx === 0}
                      style={[
                        tw`p-1 rounded mr-1`,
                        { opacity: idx === 0 ? 0.3 : 1, backgroundColor: colors.placeholderBg },
                      ]}
                      accessibilityLabel={t('seller.moveImageUp')}
                    >
                      <MaterialCommunityIcons name="arrow-up" size={14} color={colors.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      onPress={() => handleMoveImage(idx, 1)}
                      disabled={idx === images.length - 1}
                      style={[
                        tw`p-1 rounded`,
                        {
                          opacity: idx === images.length - 1 ? 0.3 : 1,
                          backgroundColor: colors.placeholderBg,
                        },
                      ]}
                      accessibilityLabel={t('seller.moveImageDown')}
                    >
                      <MaterialCommunityIcons name="arrow-down" size={14} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Add Images Tile (shown when < 8 images) */}
          {images.length < MAX_IMAGES && (
            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={pickImages}
              style={[
                tw`rounded-xl items-center justify-center border mb-2`,
                {
                  width: images.length === 0 ? '100%' : '48.5%',
                  height: images.length === 0 ? 150 : 162,
                  backgroundColor: colors.placeholderBg,
                  borderColor: colors.border,
                  borderStyle: 'dashed',
                },
              ]}
            >
              <MaterialCommunityIcons name="camera-plus-outline" size={30} color={colors.primary} />
              <Text style={[tw`text-xs font-bold mt-2`, { color: colors.primary }]}>
                {t('seller.addImagesBtn')}
              </Text>
              <Text style={[tw`text-[11px] mt-0.5`, { color: colors.textSecondary }]}>
                {t('seller.imagesCounter', { count: images.length, max: MAX_IMAGES })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

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
              <TouchableOpacity accessible={true} accessibilityRole="button"
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
          <TouchableOpacity accessible={true} accessibilityRole="button"
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
                  <TouchableOpacity accessible={true} accessibilityRole="button"
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
              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => setShowAddVariant(false)}
                style={[tw`px-3 py-2 rounded-lg border mr-2`, { borderColor: colors.border }]}
              >
                <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                  {t('seller.cancelAddVariant')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity accessible={true} accessibilityRole="button"
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

      <AnimatedPressable
        accessible={true}
        accessibilityRole="button"
        style={[
          {
            borderRadius: 16,
            overflow: 'hidden',
            marginTop: 10,
            borderBottomWidth: 3,
            borderBottomColor: '#960B21',
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.28)',
          },
          loading || anyUploading || loadingCategories ? null : shadows.tactilePrimary,
        ]}
        onPress={handleSave}
        disabled={loading || anyUploading || loadingCategories}
        scaleTo={0.96}
      >
        <LinearGradient
          colors={
            loading || anyUploading || loadingCategories
              ? [colors.disabledBg, colors.disabledBg]
              : [colors.primary, colors.primaryHover]
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
      </AnimatedPressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
