const fs = require('fs');
const path = require('path');

const filePath = path.resolve('mobile/src/screens/buyer/ProductDetailsScreen.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Linking to react-native imports
content = content.replace(
  '  Alert,\n} from \'react-native\';',
  '  Alert,\n  Linking,\n} from \'react-native\';'
);

// 2. Add inspection badge and WhatsApp button before the seller row
const targetMarker = '          {/* Seller row: "Продавец: <sellerName>" */}';
const addition = `          {/* Open-Box Inspection Badge (GAP-BUY-01) */}
          {product.allowInspection !== false && (
            <View
              style={[
                tw\`flex-row items-center p-3 rounded-2xl mb-3 border\`,
                { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
              ]}
            >
              <MaterialCommunityIcons name="shield-check" size={22} color="#059669" />
              <View style={tw\`ml-2.5 flex-1\`}>
                <Text style={[tw\`font-bold text-xs\`, { color: '#065F46' }]}>
                  {t('product.allowInspectionTitle')}
                </Text>
                <Text style={[tw\`text-[11px] mt-0.5\`, { color: '#047857' }]}>
                  {t('product.allowInspectionDesc')}
                </Text>
              </View>
            </View>
          )}

          {/* WhatsApp Direct Inquiry Button (GAP-BUY-03) */}
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={() => {
              const text = encodeURIComponent(
                (isRTL ? 'مرحباً، أود الاستفسار عن المنتج: ' : 'Hello, I have an inquiry about product: ') +
                  (product.name || '') + ' (#' + (product.id || '') + ')'
              );
              Linking.openURL(\`https://wa.me/201000000000?text=\${text}\`).catch(() => {
                Alert.alert(t('common.error'), isRTL ? 'تعذر فتح تطبيق واتساب' : 'Could not open WhatsApp');
              });
            }}
            style={[
              tw\`flex-row items-center justify-center p-3 rounded-2xl mb-3 border\`,
              { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
            ]}
          >
            <MaterialCommunityIcons name="whatsapp" size={20} color="#16A34A" />
            <Text style={[tw\`font-bold text-xs ml-2\`, { color: '#15803D' }]}>
              {t('product.whatsappInquiry')}
            </Text>
          </TouchableOpacity>

          {/* Seller row: "Продавец: <sellerName>" */}`;

content = content.replace(targetMarker, addition);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched ProductDetailsScreen.js with inspection badge and WhatsApp button');
