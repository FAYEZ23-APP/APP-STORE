const fs = require('fs');
const path = require('path');

// 1. MyOrdersScreen.js
const myOrdersPath = path.join(__dirname, '../mobile/src/screens/buyer/MyOrdersScreen.js');
let myOrders = fs.readFileSync(myOrdersPath, 'utf8');

if (!myOrders.includes('invoiceOrder !== null')) {
  const invoiceModalJsx = `
      {/* Invoice Summary Modal */}
      <Modal
        visible={invoiceOrder !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setInvoiceOrder(null)}
      >
        <View style={tw\`flex-1 bg-black/60 justify-end sm:justify-center p-0 sm:p-4\`}>
          <View style={tw\`bg-white rounded-t-3xl sm:rounded-3xl p-6 max-h-[85%]\`}>
            {invoiceOrder && (
              <>
                <View style={tw\`flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4\`}>
                  <View>
                    <Text style={tw\`text-slate-900 font-black text-base\`}>
                      {t('invoice.title')}
                    </Text>
                    <Text style={tw\`text-orange-600 font-mono text-xs\`}>
                      #{invoiceOrder.id}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setInvoiceOrder(null)}>
                    <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Meta info */}
                  <View style={tw\`bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-3\`}>
                    <View style={tw\`flex-row justify-between mb-1\`}>
                      <Text style={tw\`text-slate-400 text-xs\`}>{t('invoice.date')}</Text>
                      <Text style={tw\`text-slate-700 font-bold text-xs\`}>
                        {formatDate(invoiceOrder.createdAt)}
                      </Text>
                    </View>
                    <View style={tw\`flex-row justify-between mb-1\`}>
                      <Text style={tw\`text-slate-400 text-xs\`}>{t('invoice.paymentMethod')}</Text>
                      <Text style={tw\`text-slate-700 font-bold text-xs\`}>
                        {invoiceOrder.paymentMethod || 'COD'}
                      </Text>
                    </View>
                    <View style={tw\`flex-row justify-between\`}>
                      <Text style={tw\`text-slate-400 text-xs\`}>{t('invoice.shippingAddress')}</Text>
                      <Text style={tw\`text-slate-700 font-bold text-xs flex-1 text-right ml-2\`}>
                        {invoiceOrder.shippingAddress || (isRTL ? 'القاهرة' : 'Cairo')}
                      </Text>
                    </View>
                  </View>

                  {/* Items List */}
                  <Text style={tw\`text-slate-800 font-bold text-xs mb-2\`}>
                    {t('invoice.item')}
                  </Text>
                  {(invoiceOrder.shipments?.flatMap((s) => s.orderItems || s.items || []) || []).map((it, idx) => {
                    const itemName = isRTL ? (it.productNameAr || it.productNameEn || it.productName) : (it.productNameEn || it.productNameAr || it.productName);
                    return (
                      <View key={\`inv-it-\${idx}\`} style={tw\`flex-row justify-between py-2 border-b border-slate-50\`}>
                        <View style={tw\`flex-1 mr-2\`}>
                          <Text numberOfLines={1} style={tw\`text-slate-800 font-bold text-xs\`}>
                            {itemName}
                          </Text>
                          <Text style={tw\`text-slate-400 text-[10px]\`}>
                            {it.quantity} x {formatCurrency(it.unitPrice || it.price || 0)}
                          </Text>
                        </View>
                        <Text style={tw\`text-slate-900 font-extrabold text-xs\`}>
                          {formatCurrency((it.unitPrice || it.price || 0) * (it.quantity || 1))}
                        </Text>
                      </View>
                    );
                  })}

                  {/* Financials */}
                  <View style={tw\`pt-3 border-t border-slate-200 mt-2\`}>
                    <View style={tw\`flex-row justify-between mb-1\`}>
                      <Text style={tw\`text-slate-500 text-xs\`}>{t('invoice.shippingFee')}</Text>
                      <Text style={tw\`text-slate-700 font-mono text-xs\`}>
                        {formatCurrency(invoiceOrder.shippingFee || 0)}
                      </Text>
                    </View>
                    {Number(invoiceOrder.discountAmount) > 0 && (
                      <View style={tw\`flex-row justify-between mb-1\`}>
                        <Text style={tw\`text-emerald-600 text-xs font-bold\`}>{t('invoice.discount')}</Text>
                        <Text style={tw\`text-emerald-600 font-mono text-xs font-bold\`}>
                          -{formatCurrency(invoiceOrder.discountAmount)}
                        </Text>
                      </View>
                    )}
                    <View style={tw\`flex-row justify-between pt-2 border-t border-slate-100\`}>
                      <Text style={tw\`text-slate-900 font-black text-sm\`}>{t('invoice.codNetDue')}</Text>
                      <Text style={tw\`text-orange-600 font-black text-sm\`}>
                        {formatCurrency(invoiceOrder.totalAmount)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Share Button with native Share.share() */}
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const shareText = \`Marketplace Order #\${invoiceOrder.id}\\nDate: \${new Date(invoiceOrder.createdAt).toLocaleDateString()}\\nTotal Due: \${formatCurrency(invoiceOrder.totalAmount)}\\nAddress: \${invoiceOrder.shippingAddress || 'Egypt'}\`;
                      await Share.share({
                        title: \`Invoice #\${invoiceOrder.id}\`,
                        message: shareText,
                      });
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                  style={tw\`mt-4 bg-orange-500 py-3 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm\`}
                >
                  <MaterialCommunityIcons name="share-variant" size={18} color="#FFF" />
                  <Text style={tw\`text-white font-bold text-xs\`}>
                    {t('invoice.share')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
`;

  myOrders = myOrders.replace(/<\/View>\s*\);\s*}\s*$/, invoiceModalJsx.trim() + '\n');
  fs.writeFileSync(myOrdersPath, myOrders, 'utf8');
  console.log('Updated MyOrdersScreen.js with Invoice modal.');
}

// 2. SellerOrdersScreen.js
const sellerOrdersPath = path.join(__dirname, '../mobile/src/screens/seller/SellerOrdersScreen.js');
let sellerOrders = fs.readFileSync(sellerOrdersPath, 'utf8');

// Ensure imports for Modal, Share, ScrollView
if (!sellerOrders.includes('Share,')) {
  sellerOrders = sellerOrders.replace(
    'Platform,',
    'Platform,\n  Modal,\n  Share,\n  ScrollView,'
  );
}

// Add waybillShipment state
if (!sellerOrders.includes('waybillShipment')) {
  sellerOrders = sellerOrders.replace(
    'const [loading, setLoading] = useState(true);',
    'const [loading, setLoading] = useState(true);\n  const [waybillShipment, setWaybillShipment] = useState(null);'
  );
}

// Add waybill button to shipment card
if (!sellerOrders.includes('invoice.waybillTitle')) {
  const waybillBtn = `
        {/* Waybill Button */}
        <TouchableOpacity
          onPress={() => setWaybillShipment(item)}
          style={[tw\`w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 flex-row items-center justify-center mt-2\`]}
        >
          <MaterialCommunityIcons name="receipt-text-outline" size={16} color={colors.textDark} style={isRTL ? tw\`ml-1.5\` : tw\`mr-1.5\`} />
          <Text style={tw\`text-xs font-bold text-slate-700\`}>
            {t('invoice.waybillTitle')}
          </Text>
        </TouchableOpacity>
  `;

  sellerOrders = sellerOrders.replace(
    /\{\/\* Action Button: Handed to Carrier \*\/\}/,
    waybillBtn.trim() + '\n\n        {/* Action Button: Handed to Carrier */}'
  );
}

// Add Waybill Modal before </View>\n  );\n}
if (!sellerOrders.includes('Waybill Summary Modal')) {
  const waybillModalJsx = `
      {/* Waybill Summary Modal */}
      <Modal
        visible={waybillShipment !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setWaybillShipment(null)}
      >
        <View style={tw\`flex-1 bg-black/60 justify-end sm:justify-center p-0 sm:p-4\`}>
          <View style={tw\`bg-white rounded-t-3xl sm:rounded-3xl p-6 max-h-[85%]\`}>
            {waybillShipment && (
              <>
                <View style={tw\`flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4\`}>
                  <View>
                    <Text style={tw\`text-slate-900 font-black text-base\`}>
                      {t('invoice.waybillTitle')}
                    </Text>
                    <Text style={tw\`text-orange-600 font-mono text-xs\`}>
                      {waybillShipment.trackingNumber || \`EGM-SH-\${waybillShipment.id}-BSTA\`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setWaybillShipment(null)}>
                    <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Waybill Barcode Simulation */}
                  <View style={tw\`bg-slate-50 p-3 rounded-2xl border border-slate-200 items-center mb-3\`}>
                    <Text style={tw\`font-mono font-black text-sm text-slate-900 mb-1\`}>
                      {waybillShipment.trackingNumber || \`EGM-SH-\${waybillShipment.id}-BSTA\`}
                    </Text>
                    <View style={tw\`h-7 w-48 bg-slate-800 rounded items-center justify-center\`}>
                      <Text style={tw\`text-white text-[10px] font-mono tracking-widest\`}>|| | |||| | ||| ||</Text>
                    </View>
                  </View>

                  {/* Routing info */}
                  <View style={tw\`bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-3 space-y-1\`}>
                    <View style={tw\`flex-row justify-between mb-1\`}>
                      <Text style={tw\`text-slate-400 text-xs\`}>{t('invoice.seller')}</Text>
                      <Text style={tw\`text-slate-800 font-bold text-xs\`}>
                        {isRTL ? 'التاجر المعتمد' : 'Verified Merchant'}
                      </Text>
                    </View>
                    <View style={tw\`flex-row justify-between mb-1\`}>
                      <Text style={tw\`text-slate-400 text-xs\`}>{t('invoice.buyer')}</Text>
                      <Text style={tw\`text-slate-800 font-bold text-xs\`}>
                        {waybillShipment.recipientFirstName || (isRTL ? 'مشتري معتمد' : 'Verified Buyer')}
                      </Text>
                    </View>
                    <View style={tw\`flex-row justify-between\`}>
                      <Text style={tw\`text-slate-400 text-xs\`}>{t('invoice.shippingAddress')}</Text>
                      <Text style={tw\`text-slate-800 font-bold text-xs\`}>
                        {waybillShipment.recipientCity || (isRTL ? 'القاهرة' : 'Cairo')}
                      </Text>
                    </View>
                  </View>

                  {/* Package items */}
                  <Text style={tw\`text-slate-800 font-bold text-xs mb-2\`}>
                    {t('invoice.item')}
                  </Text>
                  {((Array.isArray(waybillShipment.items) && waybillShipment.items.length > 0
                    ? waybillShipment.items
                    : [{ productName: isRTL ? 'طرد شحنة' : 'Shipment Package', quantity: 1, unitPrice: waybillShipment.itemsSubtotal || 0 }]
                  )).map((it, idx) => (
                    <View key={\`wb-it-\${idx}\`} style={tw\`flex-row justify-between py-2 border-b border-slate-50\`}>
                      <View style={tw\`flex-1 mr-2\`}>
                        <Text numberOfLines={1} style={tw\`text-slate-800 font-bold text-xs\`}>
                          {it.productName}
                        </Text>
                        <Text style={tw\`text-slate-400 text-[10px]\`}>
                          x{it.quantity}
                        </Text>
                      </View>
                      <Text style={tw\`text-slate-900 font-bold text-xs\`}>
                        {formatCurrency((it.unitPrice || 0) * (it.quantity || 1))}
                      </Text>
                    </View>
                  ))}

                  {/* COD Due */}
                  <View style={tw\`bg-orange-50 p-3 rounded-2xl border border-orange-200 flex-row justify-between items-center mt-3\`}>
                    <Text style={tw\`text-orange-950 font-bold text-xs\`}>{t('invoice.codNetDue')}:</Text>
                    <Text style={tw\`text-orange-600 font-black text-sm\`}>
                      {formatCurrency(waybillShipment.codAmount || 0)}
                    </Text>
                  </View>
                </ScrollView>

                {/* Share Button */}
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const shareText = \`Waybill #\${waybillShipment.trackingNumber || waybillShipment.id}\\nRecipient: \${waybillShipment.recipientFirstName || 'Buyer'} (\${waybillShipment.recipientCity || 'Egypt'})\\nCOD Amount: \${formatCurrency(waybillShipment.codAmount || 0)}\`;
                      await Share.share({
                        title: \`Waybill #\${waybillShipment.id}\`,
                        message: shareText,
                      });
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                  style={tw\`mt-4 bg-orange-500 py-3 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm\`}
                >
                  <MaterialCommunityIcons name="share-variant" size={18} color="#FFF" />
                  <Text style={tw\`text-white font-bold text-xs\`}>
                    {t('invoice.share')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
`;

  sellerOrders = sellerOrders.replace(/<\/View>\s*\);\s*}\s*$/, waybillModalJsx.trim() + '\n');
  fs.writeFileSync(sellerOrdersPath, sellerOrders, 'utf8');
  console.log('Updated SellerOrdersScreen.js with Waybill modal.');
}
