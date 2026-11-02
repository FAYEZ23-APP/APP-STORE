const fs = require('fs');
const files = [
  'mobile/src/screens/buyer/CartScreen.js',
  'mobile/src/screens/buyer/CatalogScreen.js',
  'mobile/src/screens/buyer/CategoriesScreen.js',
  'mobile/src/screens/buyer/MobileSearchScreen.js',
  'mobile/src/screens/buyer/MyOrdersScreen.js',
  'mobile/src/screens/buyer/ProductDetailsScreen.js',
  'mobile/src/screens/buyer/SellerStoreScreen.js',
  'mobile/src/screens/buyer/WishlistScreen.js',
  'mobile/src/screens/common/NotificationsScreen.js',
  'mobile/src/screens/seller/MyProductsScreen.js',
  'mobile/src/screens/seller/SellerOrdersScreen.js'
];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const hasPlatform = /import\s+[^;]*Platform[^;]*from\s+['"]react-native['"]/.test(content);
  const count = (content.match(/<FlatList/g) || []).length;
  console.log(f, '-> FlatLists:', count, 'hasPlatform:', hasPlatform);
});
