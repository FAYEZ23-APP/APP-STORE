const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../mobile/src/components/buyer/OrderDetailsModal.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetAddress = `  const shippingAddressText = order.shippingAddress || order.addressLine || (
    [order.governorate, order.city, order.area, order.streetBuilding].filter(Boolean).join('، ')
  ) || (isRTL ? 'القاهرة' : 'Cairo');`;

const replacementAddress = `  const detailedParts = [
    order.governorate,
    order.city,
    order.area,
    order.streetBuilding,
    order.buildingNumber ? (isRTL ? \`عقار \${order.buildingNumber}\` : \`Bldg \${order.buildingNumber}\`) : null,
    order.floor ? (isRTL ? \`دور \${order.floor}\` : \`Floor \${order.floor}\`) : null,
    order.apartment ? (isRTL ? \`شقة \${order.apartment}\` : \`Apt \${order.apartment}\`) : null,
  ].filter(Boolean).join('، ');

  const shippingAddressText = order.shippingAddress || detailedParts || order.addressLine || (isRTL ? 'القاهرة' : 'Cairo');`;

content = content.replace(targetAddress, replacementAddress);

const targetMetaBox = `              <View style={tw\`flex-row justify-between\`}>
                <Text style={[tw\`text-xs\`, { color: colors.textSecondary }]}>{t('invoice.shippingAddress')}</Text>
                <Text style={[tw\`font-bold text-xs flex-1 text-right ml-2\`, { color: colors.textPrimary }]}>
                  {shippingAddressText}
                </Text>
              </View>
            </View>`;

const replacementMetaBox = `              <View style={tw\`flex-row justify-between\`}>
                <Text style={[tw\`text-xs\`, { color: colors.textSecondary }]}>{t('invoice.shippingAddress')}</Text>
                <Text style={[tw\`font-bold text-xs flex-1 text-right ml-2\`, { color: colors.textPrimary }]}>
                  {shippingAddressText}
                </Text>
              </View>
              {order.landmark ? (
                <View style={tw\`flex-row justify-between mt-1\`}>
                  <Text style={[tw\`text-xs\`, { color: colors.textSecondary }]}>{isRTL ? 'معلم استرشادي' : 'Landmark'}</Text>
                  <Text style={[tw\`font-bold text-xs flex-1 text-right ml-2\`, { color: colors.textPrimary }]}>
                    {order.landmark}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Inspection Badge (GAP-BUY-01) */}
            <View style={[tw\`p-3 rounded-2xl border mb-3 flex-row items-center\`, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <MaterialCommunityIcons name="check-decagram" size={16} color="#059669" style={tw\`me-2\`} />
              <Text style={[tw\`text-xs font-bold flex-1\`, { color: '#065F46' }]}>
                {t('product.allowInspectionTitle', isRTL ? 'معاينة الطرد عند الاستلام أمام المندوب' : 'Open-box inspection upon delivery permitted')}
              </Text>
            </View>`;

content = content.replace(targetMetaBox, replacementMetaBox);

fs.writeFileSync(filePath, content, 'utf8');
console.log('OrderDetailsModal.js successfully updated.');
