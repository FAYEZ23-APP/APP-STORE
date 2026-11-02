const fs = require('fs');

function updateFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCrlf = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');

  for (const { search, replace } of replacements) {
    const normSearch = search.replace(/\r\n/g, '\n');
    const normReplace = replace.replace(/\r\n/g, '\n');
    if (!content.includes(normSearch)) {
      console.error(`FAILED to find search string in ${filePath}:\n${normSearch.substring(0, 100)}...`);
      return false;
    }
    content = content.replace(normSearch, normReplace);
  }

  if (isCrlf) {
    content = content.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath}`);
  return true;
}

const windowingProps = `        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
`;

// 1. CartScreen.js
updateFile('mobile/src/screens/buyer/CartScreen.js', [{
  search: `<FlatList
        data={cartList}`,
  replace: `<FlatList
        data={cartList}
${windowingProps.trimEnd()}`
}]);

// 2. CatalogScreen.js
updateFile('mobile/src/screens/buyer/CatalogScreen.js', [
  {
    search: `<FlatList
          data={newArrivals}
          horizontal`,
    replace: `<FlatList
          data={newArrivals}
          horizontal
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}`
  },
  {
    search: `<FlatList
        data={products}
        numColumns={2}`,
    replace: `<FlatList
        data={products}
        numColumns={2}
${windowingProps.trimEnd()}`
  }
]);

// 3. CategoriesScreen.js
updateFile('mobile/src/screens/buyer/CategoriesScreen.js', [{
  search: `<FlatList
        data={allCategoryItems}
        numColumns={2}`,
  replace: `<FlatList
        data={allCategoryItems}
        numColumns={2}
${windowingProps.trimEnd()}`
}]);

// 4. MobileSearchScreen.js
updateFile('mobile/src/screens/buyer/MobileSearchScreen.js', [{
  search: `<FlatList
          data={results.items}
          keyExtractor={(item) => String(item.id)}`,
  replace: `<FlatList
          data={results.items}
          keyExtractor={(item) => String(item.id)}
${windowingProps.trimEnd()}`
}]);

// 5. MyOrdersScreen.js
updateFile('mobile/src/screens/buyer/MyOrdersScreen.js', [
  {
    search: `<FlatList
          data={buyerReturns}
          keyExtractor={(ret) => \`buyer-return-\${ret.id}\`}`,
    replace: `<FlatList
          data={buyerReturns}
          keyExtractor={(ret) => \`buyer-return-\${ret.id}\`}
${windowingProps.trimEnd()}`
  },
  {
    search: `<FlatList
          data={filteredOrders}
          keyExtractor={(item) => \`buyer-order-\${item.id}\`}`,
    replace: `<FlatList
          data={filteredOrders}
          keyExtractor={(item) => \`buyer-order-\${item.id}\`}
${windowingProps.trimEnd()}`
  }
]);

// 6. ProductDetailsScreen.js
updateFile('mobile/src/screens/buyer/ProductDetailsScreen.js', [
  {
    search: `<FlatList
            ref={galleryListRef}
            data={rawImages}
            horizontal`,
    replace: `<FlatList
            ref={galleryListRef}
            data={rawImages}
            horizontal
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews={Platform.OS === 'android'}`
  },
  {
    search: `<FlatList
                data={similarProducts}
                horizontal`,
    replace: `<FlatList
                data={similarProducts}
                horizontal
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}`
  }
]);

// 7. SellerStoreScreen.js - already updated or check
const sellerStore = fs.readFileSync('mobile/src/screens/buyer/SellerStoreScreen.js', 'utf8');
if (!sellerStore.includes('initialNumToRender')) {
  updateFile('mobile/src/screens/buyer/SellerStoreScreen.js', [{
    search: `<FlatList
        data={storeData.products || []}
        numColumns={2}`,
    replace: `<FlatList
        data={storeData.products || []}
        numColumns={2}
${windowingProps.trimEnd()}`
  }]);
}

// 8. WishlistScreen.js
updateFile('mobile/src/screens/buyer/WishlistScreen.js', [{
  search: `<FlatList
        data={items}
        keyExtractor={(item) => String(item.id || item.productId)}`,
  replace: `<FlatList
        data={items}
        keyExtractor={(item) => String(item.id || item.productId)}
${windowingProps.trimEnd()}`
}]);

// 9. NotificationsScreen.js
updateFile('mobile/src/screens/common/NotificationsScreen.js', [{
  search: `<FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}`,
  replace: `<FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
${windowingProps.trimEnd()}`
}]);

// 10. MyProductsScreen.js - already updated or check
const myProd = fs.readFileSync('mobile/src/screens/seller/MyProductsScreen.js', 'utf8');
if (!myProd.includes('initialNumToRender')) {
  updateFile('mobile/src/screens/seller/MyProductsScreen.js', [
    {
      search: `<FlatList
          key="seller-products-grid"
          data={filteredProducts}
          numColumns={2}`,
      replace: `<FlatList
          key="seller-products-grid"
          data={filteredProducts}
          numColumns={2}
${windowingProps.trimEnd()}`
    },
    {
      search: `<FlatList
          key="seller-reviews-list"
          data={reviews}`,
      replace: `<FlatList
          key="seller-reviews-list"
          data={reviews}
${windowingProps.trimEnd()}`
    }
  ]);
}

// 11. SellerOrdersScreen.js
updateFile('mobile/src/screens/seller/SellerOrdersScreen.js', [{
  search: `<FlatList
          data={activeFilter === 'ReturnRequests' ? returnsList : filteredShipments}
          keyExtractor={(item) => (activeFilter === 'ReturnRequests' ? \`return-\${item.id}\` : \`seller-shipment-\${item.id}\`)}`,
  replace: `<FlatList
          data={activeFilter === 'ReturnRequests' ? returnsList : filteredShipments}
          keyExtractor={(item) => (activeFilter === 'ReturnRequests' ? \`return-\${item.id}\` : \`seller-shipment-\${item.id}\`)}
${windowingProps.trimEnd()}`
}]);
