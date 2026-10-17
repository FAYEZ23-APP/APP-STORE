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
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
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
              'تنبيه التاجر',
              'يجب تحديد محافظة/مدينة الشحن للتاجر أولاً من شاشة "حسابي" قبل البدء بإضافة المنتجات.',
              [
                {
                  text: 'الذهاب لحسابي',
                  onPress: () => navigation.navigate('Profile'),
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
          Alert.alert(t('common.error'), 'Failed to load categories');
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
      Alert.alert(t('common.error'), 'Could not open image picker');
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
      Alert.alert(t('common.error'), err.response?.data?.error || 'Failed to upload image');
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
      Alert.alert(t('common.error'), 'يرجى إدخال وزن المنتج بالجرام بشكل صحيح');
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
            {t('seller.price')} (ج.م) *
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
            {t('seller.oldPrice')} (ج.م)
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
            {t('seller.stock')} (قطع) *
          </Text>
          <TextInput
            style={[
              tw`w-full h-12 border rounded-xl px-4`,
              { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder="الكمية"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={stock}
            onChangeText={setStock}
          />
        </View>

        <View style={tw`flex-1 ml-1.5`}>
          <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('seller.weightGrams')} *
          </Text>
          <TextInput
            style={[
              tw`w-full h-12 border rounded-xl px-4`,
              { borderColor: colors.border, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder="500"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={weightGrams}
            onChangeText={setWeightGrams}
          />
        </View>
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
