const fs = require('fs');

function update(file, searchStr, replaceStr) {
  let content = fs.readFileSync(file, 'utf8');
  const isCrlf = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');
  const s = searchStr.replace(/\r\n/g, '\n');
  const r = replaceStr.replace(/\r\n/g, '\n');
  if (!content.includes(s)) {
    console.error(`FAILED to find in ${file}`);
    return false;
  }
  content = content.replace(s, r);
  if (isCrlf) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Successfully updated ${file}`);
  return true;
}

// 1. CatalogScreen.js
update('mobile/src/screens/buyer/CatalogScreen.js',
`        <FlatList
          data={newArrivals}
          horizontal`,
`        <FlatList
          data={newArrivals}
          horizontal
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}`
);

update('mobile/src/screens/buyer/CatalogScreen.js',
`        <FlatList
          data={products}
          numColumns={2}`,
`        <FlatList
          data={products}
          numColumns={2}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}`
);

// 2. MobileSearchScreen.js
update('mobile/src/screens/buyer/MobileSearchScreen.js',
`            <FlatList
              data={results.items}
              keyExtractor={(item) => String(item.id)}`,
`            <FlatList
              data={results.items}
              keyExtractor={(item) => String(item.id)}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}`
);

// 3. MyOrdersScreen.js
update('mobile/src/screens/buyer/MyOrdersScreen.js',
`        <FlatList
          data={buyerReturns}
          keyExtractor={(ret) => \`buyer-return-\${ret.id}\`}`,
`        <FlatList
          data={buyerReturns}
          keyExtractor={(ret) => \`buyer-return-\${ret.id}\`}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}`
);

update('mobile/src/screens/buyer/MyOrdersScreen.js',
`      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => \`buyer-order-\${item.id}\`}`,
`      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => \`buyer-order-\${item.id}\`}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}`
);

// 4. ProductDetailsScreen.js
update('mobile/src/screens/buyer/ProductDetailsScreen.js',
`              <FlatList
                ref={galleryListRef}
                data={rawImages}
                horizontal`,
`              <FlatList
                ref={galleryListRef}
                data={rawImages}
                horizontal
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews={Platform.OS === 'android'}`
);

update('mobile/src/screens/buyer/ProductDetailsScreen.js',
`            <FlatList
              data={similarProducts}
              horizontal`,
`            <FlatList
              data={similarProducts}
              horizontal
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}`
);

// 5. WishlistScreen.js
update('mobile/src/screens/buyer/WishlistScreen.js',
`        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id || item.productId)}`,
`        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id || item.productId)}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}`
);

// 6. NotificationsScreen.js
update('mobile/src/screens/common/NotificationsScreen.js',
`        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}`,
`        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}`
);

// 7. SellerOrdersScreen.js
update('mobile/src/screens/seller/SellerOrdersScreen.js',
`      <FlatList
        data={activeFilter === 'ReturnRequests' ? returnsList : filteredShipments}
        keyExtractor={(item) => (activeFilter === 'ReturnRequests' ? \`return-\${item.id}\` : \`seller-shipment-\${item.id}\`)}`,
`      <FlatList
        data={activeFilter === 'ReturnRequests' ? returnsList : filteredShipments}
        keyExtractor={(item) => (activeFilter === 'ReturnRequests' ? \`return-\${item.id}\` : \`seller-shipment-\${item.id}\`)}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}`
);
