const assert = require('assert');
const fs = require('fs');

console.log('========================================================');
console.log('🧪 TESTING GUEST USER ACTION REDIRECTIONS TO LOGIN SCREEN');
console.log('========================================================');

const readNorm = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// 1. Verify ProductDetailsScreen.js
const pdsContent = readNorm('d:/Backend/marketplace/mobile/src/screens/buyer/ProductDetailsScreen.js');
assert.ok(pdsContent.includes("import { AuthContext } from '../../context/AuthContext';"), 'ProductDetailsScreen must import AuthContext');
assert.ok(pdsContent.includes("const { userId } = useContext(AuthContext);"), 'ProductDetailsScreen must read userId');
assert.ok(pdsContent.includes("if (!userId) {\n      navigation.navigate('Login');\n      return;\n    }\n    if (isOutOfStock) return;\n    const qtyToAdd = Math.min(stock, Math.max(1, selectedQty));"), 'handleAddToCart must redirect to Login if !userId');
assert.ok(pdsContent.includes("if (!userId) {\n      navigation.navigate('Login');\n      return;\n    }\n    if (isOutOfStock) return;\n    const qty = Math.min(stock, Math.max(1, selectedQty));"), 'handleBuyNow must redirect to Login if !userId');
assert.ok(pdsContent.includes("if (!userId) {\n      navigation.navigate('Login');\n      return;\n    }\n    try {\n      await toggleWishlist(productId);"), 'handleToggleWishlist must redirect to Login if !userId');
console.log('✅ PASS: ProductDetailsScreen redirects Add to Cart, Buy Now, and Wishlist to Login when !userId');

// 2. Verify ProductCard.js
const pcContent = readNorm('d:/Backend/marketplace/mobile/src/components/ProductCard.js');
assert.ok(pcContent.includes("import { AuthContext } from '../context/AuthContext';"), 'ProductCard must import AuthContext');
assert.ok(pcContent.includes("const { userId } = useContext(AuthContext);"), 'ProductCard must read userId');
assert.ok(pcContent.includes("if (!userId) {\n      navigation.navigate('Login');\n      return;\n    }\n    if (isOutOfStock) return;\n    add(product, 1);"), 'ProductCard handleAddToCart must redirect to Login if !userId');
assert.ok(pcContent.includes("if (!userId) {\n      navigation.navigate('Login');\n      return;\n    }\n    const next = !isFavorite;\n    toggleWishlist(product.id)"), 'ProductCard handleFavoritePress must redirect to Login if !userId');
assert.ok(pcContent.includes("if (!userId) {\n      navigation.navigate('Login');\n      return;\n    }\n    try {\n      navigation.navigate('Cart');"), 'ProductCard handleOpenCart must redirect to Login if !userId');
console.log('✅ PASS: ProductCard redirects quick-add, heart wishlist, and open cart to Login when !userId');

// 3. Verify BuyerTabs.js
const tabsContent = readNorm('d:/Backend/marketplace/mobile/src/navigation/BuyerTabs.js');
assert.ok(tabsContent.includes("import { AuthContext } from '../context/AuthContext';"), 'BuyerTabs must import AuthContext');
assert.ok(tabsContent.includes("const { userId } = useContext(AuthContext);"), 'BuyerTabs must read userId');
assert.ok(tabsContent.includes("tabPress: (e) => {\n            if (!userId) {\n              e.preventDefault();\n              nav.navigate('Login');\n            }\n          }"), 'BuyerTabs MyOrders tab tabPress redirects guest to Login');
console.log('✅ PASS: BuyerTabs MyOrders tab tabPress redirects guest to Login');

// 4. Verify MyOrdersScreen.js
const ordersContent = readNorm('d:/Backend/marketplace/mobile/src/screens/buyer/MyOrdersScreen.js');
assert.ok(ordersContent.includes("import { AuthContext } from '../../context/AuthContext';"), 'MyOrdersScreen must import AuthContext');
assert.ok(ordersContent.includes("const { userId } = useContext(AuthContext);"), 'MyOrdersScreen must read userId');
assert.ok(ordersContent.includes("if (!userId) {\n      setLoading(false);\n      setRefreshing(false);\n      setOrders([]);\n      return;\n    }"), 'MyOrdersScreen fetchOrders must abort for guest');
assert.ok(ordersContent.includes("if (!userId) {\n    return ("), 'MyOrdersScreen must render Guest Gate when !userId');
assert.ok(ordersContent.includes("onPress={() => navigation.navigate('Login')}"), 'MyOrdersScreen Guest Gate has Login button');
console.log('✅ PASS: MyOrdersScreen renders Guest Gate with Login CTA and avoids unauth API requests when !userId');

// 5. Verify CartScreen.js
const cartContent = readNorm('d:/Backend/marketplace/mobile/src/screens/buyer/CartScreen.js');
assert.ok(cartContent.includes("import { AuthContext } from '../../context/AuthContext';"), 'CartScreen must import AuthContext');
assert.ok(cartContent.includes("const { userId } = useContext(AuthContext);"), 'CartScreen must read userId');
assert.ok(cartContent.includes("if (!userId) {\n      navigation.navigate('Login');\n      return;\n    }\n    if (cartList.length === 0) return;\n    navigation.navigate('Checkout', { cartItems: cartList });"), 'handleProceedToCheckout must redirect to Login if !userId');
console.log('✅ PASS: CartScreen handleProceedToCheckout redirects guest to Login');

// 6. Verify CatalogScreen.js
const catalogContent = readNorm('d:/Backend/marketplace/mobile/src/screens/buyer/CatalogScreen.js');
assert.ok(catalogContent.includes("import { AuthContext } from '../../context/AuthContext';"), 'CatalogScreen must import AuthContext');
assert.ok(catalogContent.includes("const { userId } = useContext(AuthContext);"), 'CatalogScreen must read userId');
assert.ok(catalogContent.includes("if (!userId) {\n                  navigation.navigate('Login');\n                } else {\n                  navigation.navigate('Wishlist');"), 'CatalogScreen wishlist header icon redirects to Login if !userId');
assert.ok(catalogContent.includes("if (!userId) {\n                  navigation.navigate('Login');\n                } else {\n                  navigation.navigate('Notifications');"), 'CatalogScreen notifications header icon redirects to Login if !userId');
console.log('✅ PASS: CatalogScreen header icons redirect guest to Login');

// 7. Verify WishlistScreen.js and NotificationsScreen.js
const wishlistContent = readNorm('d:/Backend/marketplace/mobile/src/screens/buyer/WishlistScreen.js');
assert.ok(wishlistContent.includes("if (!userId) {\n      setLoading(false);\n      setRefreshing(false);\n      setItems([]);\n      return;\n    }"), 'WishlistScreen fetchItems aborts when !userId');
assert.ok(wishlistContent.includes("if (!userId) {\n        <View style={tw`flex-1 items-center justify-center px-6`}>") || wishlistContent.includes("!userId ? (\n        <View style={tw`flex-1 items-center justify-center px-6`}>"), 'WishlistScreen renders Guest Gate when !userId');
const notifContent = readNorm('d:/Backend/marketplace/mobile/src/screens/common/NotificationsScreen.js');
assert.ok(notifContent.includes("if (!userId) {\n      setLoading(false);\n      setRefreshing(false);\n      setNotifications([]);\n      return;\n    }"), 'NotificationsScreen fetchNotifs aborts when !userId');
assert.ok(notifContent.includes("!userId ? (\n        <View style={tw`flex-1 items-center justify-center px-6`}>"), 'NotificationsScreen renders Guest Gate when !userId');
console.log('✅ PASS: WishlistScreen and NotificationsScreen render Guest Gate when !userId');

console.log('========================================================');
console.log('🎉 ALL 7/7 GUEST AUTH REDIRECTION CHECKS PASSED!');
console.log('========================================================');
