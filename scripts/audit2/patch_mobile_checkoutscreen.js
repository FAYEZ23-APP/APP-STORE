const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../mobile/src/screens/buyer/CheckoutScreen.js');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// 1. Add addressId and landmark in payload
const payloadAnchor = `      deliveryNotes: deliveryNotes.trim() || null,
      paymentMethod: 'OnReceipt',`;

const payloadUpdated = `      deliveryNotes: deliveryNotes.trim() || null,
      landmark: deliveryNotes.trim() || null,
      addressId: selectedAddressId || null,
      paymentMethod: 'OnReceipt',`;

if (content.includes(payloadAnchor)) {
    content = content.replace(payloadAnchor, payloadUpdated);
}

// 2. Add inspection badge in trust box
const trustAnchor = `          {/* Consumer Protection Notice */}
          <View style={styles.trustFooterBox}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#059669" />
            <Text style={styles.trustFooterText}>
              {isRTL
                ? 'دفع آمن 100% نقداً عند الاستلام مع حق المعاينة وفقاً لقانون حماية المستهلك'
                : '100% Secure Cash on Delivery with full inspection right'}
            </Text>
          </View>`;

const trustUpdated = `          {/* Consumer Protection Notice */}
          <View style={styles.trustFooterBox}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#059669" />
            <Text style={styles.trustFooterText}>
              {isRTL
                ? 'دفع آمن 100% نقداً عند الاستلام مع حق المعاينة وفقاً لقانون حماية المستهلك'
                : '100% Secure Cash on Delivery with full inspection right'}
            </Text>
          </View>

          {/* Inspection Badge (GAP-BUY-01) */}
          <View style={[styles.trustFooterBox, { marginTop: 6, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <MaterialCommunityIcons name="check-decagram" size={16} color="#059669" />
            <Text style={[styles.trustFooterText, { color: '#065F46', fontWeight: 'bold' }]}>
              {t('product.allowInspectionTitle', isRTL ? 'معاينة الطرد عند الاستلام أمام المندوب' : 'Open-box inspection upon delivery permitted')}
            </Text>
          </View>`;

if (content.includes(trustAnchor)) {
    content = content.replace(trustAnchor, trustUpdated);
}

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Mobile CheckoutScreen.js successfully updated.');
