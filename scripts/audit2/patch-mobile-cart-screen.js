const fs = require('fs');
const path = require('path');

const filePath = path.resolve('mobile/src/screens/buyer/CartScreen.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add AuthContext to imports
content = content.replace(
  "import { CartContext } from '../../context/CartContext';",
  "import { CartContext } from '../../context/CartContext';\nimport { AuthContext } from '../../context/AuthContext';"
);

// 2. Consume userRole inside component
content = content.replace(
  '  const isRTL = i18n.language === \'ar\';',
  '  const isRTL = i18n.language === \'ar\';\n  const { userRole } = useContext(AuthContext);'
);

// 3. Update handleProceedToCheckout to check authentication for guest users
const checkoutTarget = `  const handleProceedToCheckout = () => {
    if (cartList.length === 0) return;
    navigation.navigate('Checkout', { cartItems: cartList });
  };`;

const checkoutReplacement = `  const handleProceedToCheckout = () => {
    if (cartList.length === 0) return;
    if (!userRole) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('Checkout', { cartItems: cartList });
  };`;
content = content.replace(checkoutTarget, checkoutReplacement);

// 4. Add multi-vendor parcel banner as ListHeaderComponent in FlatList
const flatListTarget = `      {/* Cart Items List */}
      <FlatList
        data={cartList}`;

const flatListReplacement = `      {/* Cart Items List */}
      <FlatList
        data={cartList}
        ListHeaderComponent={
          (() => {
            const sellerCount = new Set(cartList.map((i) => i.product?.sellerId || 'seller')).size;
            if (sellerCount <= 1) return null;
            return (
              <View
                style={[
                  tw\`flex-row items-center p-3 rounded-xl mb-3 border\`,
                  { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                ]}
              >
                <MaterialCommunityIcons name="package-variant-closed" size={20} color="#D97706" />
                <View style={tw\`ml-2 flex-1\`}>
                  <Text style={[tw\`font-bold text-xs\`, { color: '#92400E' }]}>
                    {t('cart.multiSellerParcelTitle')}
                  </Text>
                  <Text style={[tw\`text-[11px] mt-0.5\`, { color: '#B45309' }]}>
                    {t('cart.multiSellerParcelDesc', { count: sellerCount })}
                  </Text>
                </View>
              </View>
            );
          })()
        }`;
content = content.replace(flatListTarget, flatListReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched CartScreen.js with guest checkout gate and multi-vendor parcel banner');
