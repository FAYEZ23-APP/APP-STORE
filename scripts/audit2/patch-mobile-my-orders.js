const fs = require('fs');
const path = require('path');

const filePath = path.resolve('mobile/src/screens/buyer/MyOrdersScreen.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add confirmOrder to ordersApi import
content = content.replace(
  "import { getMyOrders, getOrderById, cancelOrder } from '../../api/ordersApi';",
  "import { getMyOrders, getOrderById, cancelOrder, confirmOrder } from '../../api/ordersApi';"
);

// 2. Add confirmingOrderId state
content = content.replace(
  "  const [cancellingOrderId, setCancellingOrderId] = useState(null);",
  "  const [cancellingOrderId, setCancellingOrderId] = useState(null);\n  const [confirmingOrderId, setConfirmingOrderId] = useState(null);"
);

// 3. Add handleConfirmOrder function after executeCancelOrder
const cancelHandlerTarget = `    } finally {
      setCancellingOrderId(null);
    }
  };`;

const confirmHandlerAddition = `    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleConfirmOrder = async (orderId) => {
    setConfirmingOrderId(orderId);
    try {
      await confirmOrder(orderId);
      Alert.alert(
        isRTL ? 'تم تأكيد الطلب' : 'Order Confirmed',
        isRTL
          ? 'تم تأكيد رغبتك في استلام الطلب بنجاح وسيتم تجهيز الشحنة والتواصل معك.'
          : 'Order confirmed successfully. Your items will be dispatched promptly.'
      );
      await fetchOrders();
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('common.error'));
    } finally {
      setConfirmingOrderId(null);
    }
  };`;

content = content.replace(cancelHandlerTarget, confirmHandlerAddition);

// 4. Add Confirm Button in Actions row
const invoiceButtonTarget = `                  <TouchableOpacity accessible={true} accessibilityRole="button"
                    onPress={() => setInvoiceOrder(item)}
                    style={tw\`px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 flex-row items-center\`}`;

const confirmButtonAddition = `                  {/* Buyer Confirmation Button (GAP-ORD-01) */}
                  {!isCancelled && (
                    item.isBuyerConfirmed ? (
                      <View style={tw\`px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 flex-row items-center\`}>
                        <MaterialCommunityIcons name="check-decagram" size={15} color="#059669" style={isRTL ? tw\`ml-1\` : tw\`mr-1\`} />
                        <Text style={tw\`text-xs font-bold text-emerald-800\`}>{t('orders.confirmed')}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        accessible={true}
                        accessibilityRole="button"
                        onPress={() => handleConfirmOrder(item.id)}
                        disabled={confirmingOrderId === item.id}
                        style={tw\`px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-600 flex-row items-center shadow-xs\`}
                      >
                        {confirmingOrderId === item.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="check-circle-outline" size={15} color="#FFFFFF" style={isRTL ? tw\`ml-1\` : tw\`mr-1\`} />
                            <Text style={tw\`text-xs font-bold text-white\`}>{t('orders.confirmOrder')}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )
                  )}

                  <TouchableOpacity accessible={true} accessibilityRole="button"
                    onPress={() => setInvoiceOrder(item)}
                    style={tw\`px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 flex-row items-center\`}`;

content = content.replace(invoiceButtonTarget, confirmButtonAddition);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched MyOrdersScreen.js with buyer order confirmation flow');
