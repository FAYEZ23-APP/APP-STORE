const fs = require('fs');
const path = require('path');

const filePath = path.resolve('mobile/src/navigation/AppNavigator.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add linking configuration before return
const linkingConfig = `  const linking = {
    prefixes: ['marketplace://', 'https://marketplace.com'],
    config: {
      screens: {
        BuyerRoot: {
          screens: {
            Catalog: 'catalog',
            Categories: 'categories',
            Cart: 'cart',
            MyOrders: 'orders',
            Profile: 'profile',
          },
        },
        ProductDetails: 'product/:productId',
        SellerStore: 'store/:sellerId',
        Checkout: 'checkout',
        Login: 'login',
      },
    },
  };

  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>`;

content = content.replace(
  '  return (\n    <NavigationContainer theme={navigationTheme}>',
  linkingConfig
);

// 2. Replace userRole == null block to allow guest browsing
const guestTarget = `        {userRole == null ? (
          // No token -> Auth Stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Verify" component={VerifyScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        ) : userRole === 'Admin' ? (`;

const guestReplacement = `        {userRole == null ? (
          // Guest User -> Can browse Catalog, Categories, Cart, Search, ProductDetails (GAP-BUY-02 & GAP-COM-02)
          <Stack.Group>
            <Stack.Screen name="BuyerRoot" component={BuyerTabs} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Verify" component={VerifyScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen
              name="Search"
              component={MobileSearchScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProductDetails"
              component={ProductDetailsScreen}
              options={{
                headerShown: true,
                title: t('buyer.productDetails'),
              }}
            />
            <Stack.Screen
              name="SellerStore"
              component={SellerStoreScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Wishlist"
              component={WishlistScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{
                headerShown: true,
                title: t('buyer.checkout'),
              }}
            />
            <Stack.Screen
              name="LocationPicker"
              component={MobileLocationPicker}
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack.Group>
        ) : userRole === 'Admin' ? (`;

content = content.replace(guestTarget, guestReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched AppNavigator.js with guest browsing and deep linking');
