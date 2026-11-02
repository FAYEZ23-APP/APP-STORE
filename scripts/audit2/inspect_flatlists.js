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
  const lines = content.split(/\r?\n/);
  console.log(`\n=== ${f} ===`);
  lines.forEach((line, idx) => {
    if (line.includes('<FlatList')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
      for (let i = idx + 1; i < Math.min(idx + 10, lines.length); i++) {
        console.log(`  ${lines[i].trim()}`);
        if (lines[i].includes('>')) break;
      }
    }
  });
});
