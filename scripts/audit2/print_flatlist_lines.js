const fs = require('fs');

const files = [
  'mobile/src/screens/buyer/CatalogScreen.js',
  'mobile/src/screens/buyer/MobileSearchScreen.js',
  'mobile/src/screens/buyer/MyOrdersScreen.js',
  'mobile/src/screens/buyer/ProductDetailsScreen.js',
  'mobile/src/screens/buyer/WishlistScreen.js',
  'mobile/src/screens/common/NotificationsScreen.js',
  'mobile/src/screens/seller/SellerOrdersScreen.js'
];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  console.log(`\n=== ${f} ===`);
  lines.forEach((l, i) => {
    if (l.includes('<FlatList')) {
      console.log(`Line ${i+1}:`);
      for (let j = i; j < Math.min(i + 6, lines.length); j++) {
        console.log(`  [${j+1}] ${JSON.stringify(lines[j])}`);
      }
    }
  });
});
