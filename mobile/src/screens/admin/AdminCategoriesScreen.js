import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../api/categoriesApi';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import AnimatedPressable from '../../components/common/AnimatedPressable';

export default function AdminCategoriesScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = i18n.language === 'ar';
  const floatingNavClearance = 64 + Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10) + 16;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await getCategories(true);
      if (res && Array.isArray(res.data)) {
        setCategories(res.data);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.warn('Failed to load admin categories:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategories();
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setNameAr('');
    setNameEn('');
    setDisplayOrder(String(categories.length + 1));
    setIsActive(true);
    setModalVisible(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setNameAr(cat.nameAr || '');
    setNameEn(cat.nameEn || cat.name || '');
    setDisplayOrder(String(cat.displayOrder ?? 0));
    setIsActive(cat.isActive !== false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!nameAr.trim() || !nameEn.trim()) {
      Alert.alert(t('common.error'), isRTL ? 'يرجى إدخال الاسمين بالعربية والإنجليزية' : 'Please enter both Arabic and English names');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        displayOrder: parseInt(displayOrder, 10) || 0,
        isActive: Boolean(isActive),
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, payload);
      } else {
        await createCategory(payload);
      }

      setModalVisible(false);
      fetchCategories();
    } catch (err) {
      console.warn('Failed to save category:', err);
      const msg = err?.response?.data?.message || err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (cat) => {
    Alert.alert(
      t('categoriesAdmin.delete'),
      t('categoriesAdmin.deleteConfirm'),
      [
        { text: t('categoriesAdmin.cancel'), style: 'cancel' },
        {
          text: t('categoriesAdmin.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              fetchCategories();
            } catch (err) {
              console.warn('Failed to delete category:', err);
              const msg =
                err?.response?.data?.message ||
                t('categoriesAdmin.hasProductsError');
              Alert.alert(t('common.error'), msg);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    return (
      <View
        style={[
          tw`bg-white rounded-2xl p-4 mb-3 mx-4 border`,
          { borderColor: 'rgba(236, 233, 230, 0.95)' },
          shadows.cardElevated,
        ]}
      >
        <View style={tw`flex-row justify-between items-start mb-2`}>
          <View style={tw`flex-row items-center gap-2`}>
            <View style={tw`w-7 h-7 rounded-lg bg-red-50 items-center justify-center`}>
              <Text style={tw`text-red-700 font-mono font-bold text-xs`}>
                #{item.id}
              </Text>
            </View>
            <View>
              <Text style={tw`text-slate-900 font-extrabold text-sm`}>
                {item.nameAr || item.name}
              </Text>
              <Text style={tw`text-slate-400 text-xs`}>
                {item.nameEn || item.name}
              </Text>
            </View>
          </View>

          <View style={tw`flex-row items-center gap-1.5`}>
            <View
              style={[
                tw`px-2 py-0.5 rounded-full`,
                item.isActive !== false ? tw`bg-emerald-50` : tw`bg-slate-100`,
              ]}
            >
              <Text
                style={[
                  tw`text-[10px] font-bold`,
                  item.isActive !== false ? tw`text-emerald-700` : tw`text-slate-400`,
                ]}
              >
                {item.isActive !== false ? t('categoriesAdmin.active') : t('categoriesAdmin.inactive')}
              </Text>
            </View>
          </View>
        </View>

        <View style={tw`flex-row justify-between items-center pt-2 mt-2 border-t border-slate-50`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`flex-row items-center gap-1`}>
              <MaterialCommunityIcons name="sort-numeric-ascending" size={14} color={colors.textMuted} />
              <Text style={tw`text-slate-500 text-xs font-mono`}>
                {item.displayOrder ?? 0}
              </Text>
            </View>

            <View style={tw`flex-row items-center gap-1`}>
              <MaterialCommunityIcons name="package-variant" size={14} color={colors.textMuted} />
              <Text style={tw`text-slate-500 text-xs`}>
                {item.productsCount ?? 0} {t('categoriesAdmin.productsCount')}
              </Text>
            </View>
          </View>

          <View style={tw`flex-row items-center gap-2`}>
            <AnimatedPressable
              accessible={true}
              accessibilityRole="button"
              onPress={() => handleOpenEdit(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              scaleTo={0.88}
              style={tw`p-2 rounded-lg bg-slate-100 border border-slate-200`}
            >
              <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textDark} />
            </AnimatedPressable>

            <AnimatedPressable
              accessible={true}
              accessibilityRole="button"
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              scaleTo={0.88}
              style={tw`p-2 rounded-lg bg-red-50 border border-red-100`}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.error} />
            </AnimatedPressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      {/* Header */}
      <View style={tw`bg-white px-5 pt-12 pb-4 border-b border-slate-100 flex-row items-center justify-between`}>
        <View style={tw`flex-row items-center gap-2`}>
          <View style={tw`w-9 h-9 rounded-xl bg-red-50 items-center justify-center`}>
            <MaterialCommunityIcons name="shape" size={20} color="#DC2626" />
          </View>
          <View>
            <Text style={tw`text-slate-900 font-black text-lg`}>
              {t('categoriesAdmin.title')}
            </Text>
            <Text style={tw`text-slate-400 text-xs`}>
              {categories.length} {t('categoriesAdmin.title')}
            </Text>
          </View>
        </View>

        <AnimatedPressable
          accessible={true}
          accessibilityRole="button"
          onPress={handleOpenAdd}
          scaleTo={0.94}
          style={[
            tw`bg-red-600 px-4 py-2.5 rounded-xl flex-row items-center gap-1.5`,
            {
              borderBottomWidth: 3,
              borderBottomColor: '#960B21',
              borderTopWidth: 1,
              borderTopColor: 'rgba(255, 255, 255, 0.28)',
              ...shadows.tactilePrimary,
            },
          ]}
        >
          <MaterialCommunityIcons name="plus" size={16} color="#FFF" />
          <Text style={tw`text-white font-bold text-xs`}>
            {t('categoriesAdmin.addCategory')}
          </Text>
        </AnimatedPressable>
      </View>

      {/* Content */}
      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      ) : categories.length === 0 ? (
        <View style={tw`flex-1 items-center justify-center px-6`}>
          <MaterialCommunityIcons name="shape-outline" size={48} color={colors.textMuted} />
          <Text style={tw`text-slate-400 text-sm mt-3`}>
            {t('categoriesAdmin.title')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={[tw`py-4`, { paddingBottom: floatingNavClearance }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#DC2626"
            />
          }
        />
      )}

      {/* Add / Edit Category Modal with KeyboardAvoidingView */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={tw`flex-1 bg-black/60 justify-center p-4`}
        >
          <View style={tw`bg-white rounded-3xl p-6 shadow-xl`}>
            <View style={tw`flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4`}>
              <Text style={tw`text-slate-900 font-black text-base`}>
                {editingCategory ? t('categoriesAdmin.editCategory') : t('categoriesAdmin.addCategory')}
              </Text>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={tw`mb-3`}>
                <Text style={tw`text-slate-700 font-bold text-xs mb-1.5`}>
                  {t('categoriesAdmin.nameAr')} *
                </Text>
                <TextInput
                  value={nameAr}
                  onChangeText={setNameAr}
                  placeholder="مثال: إلكترونيات"
                  placeholderTextColor="#94A3B8"
                  style={tw`bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900`}
                />
              </View>

              <View style={tw`mb-3`}>
                <Text style={tw`text-slate-700 font-bold text-xs mb-1.5`}>
                  {t('categoriesAdmin.nameEn')} *
                </Text>
                <TextInput
                  value={nameEn}
                  onChangeText={setNameEn}
                  placeholder="e.g. Electronics"
                  placeholderTextColor="#94A3B8"
                  style={tw`bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900`}
                />
              </View>

              <View style={tw`mb-3`}>
                <Text style={tw`text-slate-700 font-bold text-xs mb-1.5`}>
                  {t('categoriesAdmin.displayOrder')}
                </Text>
                <TextInput
                  value={displayOrder}
                  onChangeText={setDisplayOrder}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={tw`bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-mono`}
                />
              </View>

              <View style={tw`flex-row items-center justify-between py-2 mb-4`}>
                <Text style={tw`text-slate-800 font-bold text-xs`}>
                  {t('categoriesAdmin.active')}
                </Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#E2E8F0', true: '#DC2626' }}
                  thumbColor="#FFF"
                />
              </View>

              <View style={tw`flex-row justify-end gap-2 pt-3 border-t border-slate-100`}>
                <TouchableOpacity accessible={true} accessibilityRole="button"
                  onPress={() => setModalVisible(false)}
                  style={tw`px-4 py-2.5 rounded-xl bg-slate-100`}
                >
                  <Text style={tw`text-slate-700 font-bold text-xs`}>
                    {t('categoriesAdmin.cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity accessible={true} accessibilityRole="button"
                  onPress={handleSave}
                  disabled={submitting}
                  style={tw`px-5 py-2.5 rounded-xl bg-red-600 flex-row items-center gap-1 shadow-sm`}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={tw`text-white font-bold text-xs`}>
                      {t('categoriesAdmin.save')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
