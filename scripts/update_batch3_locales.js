const fs = require('fs');
const path = require('path');

const batch3Ar = {
  wishlist: {
    title: "قائمة الرغبات",
    emptyTitle: "قائمة الرغبات فارغة",
    emptySubtitle: "احفظ المنتجات التي تعجبك لتصل إليها بسهولة لاحقاً",
    addToCart: "أضف إلى السلة",
    moveToCart: "نقل إلى السلة",
    removeFromWishlist: "إزالة من المفضلة",
    itemCount: "{{count}} منتج",
    addedSuccess: "تمت إضافة المنتج إلى المفضلة",
    removedSuccess: "تمت إزالة المنتج من المفضلة",
    viewWishlist: "عرض قائمة الرغبات",
    inStock: "متوفر",
    outOfStock: "نفذ من المخزون",
    all: "الكل"
  },
  notifications: {
    title: "الإشعارات",
    emptyTitle: "لا توجد إشعارات جديدة",
    emptySubtitle: "سنعلمك بأي تحديثات على طلباتك وعملياتك المالية",
    markAllRead: "تحديد الكل كمقروء",
    markAsRead: "تحديد كمقروء",
    unread: "غير مقروء",
    order: "طلب",
    shipment: "شحنة",
    payout: "سحب رصيد",
    return: "مرتجع",
    system: "النظام",
    viewOrder: "عرض الطلب",
    viewWallet: "عرض المحفظة",
    allCaughtUp: "أنت على اطلاع بكل جديد",
    notificationCount: "{{count}} إشعار غير مقروء"
  },
  categoriesAdmin: {
    title: "إدارة الفئات",
    addCategory: "إضافة فئة جديدة",
    editCategory: "تعديل الفئة",
    nameAr: "الاسم بالعربية",
    nameEn: "الاسم بالإنجليزية",
    displayOrder: "ترتيب العرض",
    status: "الحالة",
    active: "نشط",
    inactive: "غير نشط",
    productsCount: "عدد المنتجات",
    saveSuccess: "تم حفظ الفئة بنجاح",
    deleteSuccess: "تم حذف الفئة بنجاح",
    deleteConfirm: "هل أنت متأكد من حذف هذه الفئة؟",
    hasProductsError: "لا يمكن حذف هذه الفئة لوجود منتجات مرتبطة بها",
    cancel: "إلغاء",
    save: "حفظ",
    delete: "حذف",
    actions: "الإجراءات"
  },
  invoice: {
    title: "فاتورة الطلب",
    waybillTitle: "بوليصة الشحن",
    orderNumber: "رقم الطلب",
    date: "التاريخ",
    buyer: "المشتري",
    seller: "البائع",
    shippingAddress: "عنوان الشحن",
    coordinates: "الإحداثيات الجغرافية",
    item: "المنتج",
    quantity: "الكمية",
    unitPrice: "سعر الوحدة",
    total: "الإجمالي",
    subtotal: "المجموع الفرعي",
    shippingFee: "رسوم التوصيل",
    discount: "الخصم",
    paymentMethod: "طريقة الدفع",
    paymentStatus: "حالة الدفع",
    codNetDue: "المبلغ المستحق للدفع عند الاستلام",
    print: "طباعة",
    share: "مشاركة الفاتورة",
    close: "إغلاق"
  }
};

const batch3En = {
  wishlist: {
    title: "Wishlist",
    emptyTitle: "Your wishlist is empty",
    emptySubtitle: "Save items you love so you can easily find them later",
    addToCart: "Add to Cart",
    moveToCart: "Move to Cart",
    removeFromWishlist: "Remove from Wishlist",
    itemCount: "{{count}} items",
    addedSuccess: "Added to wishlist",
    removedSuccess: "Removed from wishlist",
    viewWishlist: "View Wishlist",
    inStock: "In Stock",
    outOfStock: "Out of Stock",
    all: "All"
  },
  notifications: {
    title: "Notifications",
    emptyTitle: "No notifications",
    emptySubtitle: "We'll notify you about updates to your orders and wallet",
    markAllRead: "Mark all as read",
    markAsRead: "Mark as read",
    unread: "Unread",
    order: "Order",
    shipment: "Shipment",
    payout: "Payout",
    return: "Return",
    system: "System",
    viewOrder: "View Order",
    viewWallet: "View Wallet",
    allCaughtUp: "You're all caught up",
    notificationCount: "{{count}} unread notifications"
  },
  categoriesAdmin: {
    title: "Category Management",
    addCategory: "Add Category",
    editCategory: "Edit Category",
    nameAr: "Arabic Name",
    nameEn: "English Name",
    displayOrder: "Display Order",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    productsCount: "Products Count",
    saveSuccess: "Category saved successfully",
    deleteSuccess: "Category deleted successfully",
    deleteConfirm: "Are you sure you want to delete this category?",
    hasProductsError: "Cannot delete category because active products are attached",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    actions: "Actions"
  },
  invoice: {
    title: "Order Invoice",
    waybillTitle: "Shipping Waybill",
    orderNumber: "Order Number",
    date: "Date",
    buyer: "Buyer",
    seller: "Seller",
    shippingAddress: "Shipping Address",
    coordinates: "GPS Coordinates",
    item: "Item",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    total: "Total",
    subtotal: "Subtotal",
    shippingFee: "Shipping Fee",
    discount: "Discount",
    paymentMethod: "Payment Method",
    paymentStatus: "Payment Status",
    codNetDue: "Cash On Delivery Amount Due",
    print: "Print",
    share: "Share Invoice",
    close: "Close"
  }
};

function updateFile(filePath, additions) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const [key, val] of Object.entries(additions)) {
    content[key] = { ...(content[key] || {}), ...val };
  }
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log(`Updated ${filePath}`);
}

const targets = [
  { path: path.join(__dirname, '../admin-web/src/locales/ar.json'), data: batch3Ar },
  { path: path.join(__dirname, '../admin-web/src/locales/en.json'), data: batch3En },
  { path: path.join(__dirname, '../mobile/src/locales/ar.json'), data: batch3Ar },
  { path: path.join(__dirname, '../mobile/src/locales/en.json'), data: batch3En },
];

targets.forEach(t => updateFile(t.path, t.data));
console.log('All 4 locale files successfully updated.');
