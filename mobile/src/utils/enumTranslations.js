import i18n from '../locales/i18n';

/**
 * Translates raw backend shipment status enum to localized human-readable label
 */
export const getShipmentStatusLabel = (status, customT) => {
  if (!status) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`shipmentStatus.${status}`, { defaultValue: status });
};

/**
 * Translates raw backend order status enum to localized human-readable label
 */
export const getOrderStatusLabel = (status, customT) => {
  if (!status) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`orderStatus.${status}`, { defaultValue: status });
};

/**
 * Translates raw return request status enum to localized human-readable label
 */
export const getReturnStatusLabel = (status, customT) => {
  if (!status) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`returnStatus.${status}`, { defaultValue: status });
};

/**
 * Translates raw return reason enum to localized human-readable label
 */
export const getReturnReasonLabel = (reason, customT) => {
  if (!reason) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`returnReason.${reason}`, { defaultValue: reason });
};

/**
 * Translates raw vendor payout status enum to localized human-readable label
 */
export const getPayoutStatusLabel = (status, customT) => {
  if (!status) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`payoutStatus.${status}`, { defaultValue: status });
};

/**
 * Translates payout method enum to localized human-readable label
 */
export const getPayoutMethodLabel = (method, customT) => {
  if (!method) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`payoutMethod.${method}`, { defaultValue: method });
};

/**
 * Translates vendor wallet transaction type enum to localized human-readable label
 */
export const getWalletTxTypeLabel = (type, customT) => {
  if (!type) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`walletTxType.${type}`, { defaultValue: type });
};

/**
 * Translates user role enum (Buyer, Seller, Admin) to localized label
 */
export const getRoleLabel = (role, customT) => {
  if (!role) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`roles.${role}`, { defaultValue: role });
};

/**
 * Translates delivery method enum (Courier, Pickup) to localized label
 */
export const getDeliveryMethodLabel = (method, customT) => {
  if (!method) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`deliveryMethod.${method}`, { defaultValue: method });
};

/**
 * Translates payment method enum (OnReceipt) to localized label
 */
export const getPaymentMethodLabel = (method, customT) => {
  if (!method) return '';
  const translate = customT || i18n.t.bind(i18n);
  return translate(`paymentMethod.${method}`, { defaultValue: method });
};
