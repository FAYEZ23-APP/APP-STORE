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

/**
 * Returns Tailwind CSS styling classes for shipment status badges
 */
export const getShipmentStatusBadgeClass = (status) => {
  switch (status) {
    case 'Created':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'HandedToCarrier':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'InTransit':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'ReadyForPickup':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Delivered':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled':
      return 'bg-gray-100 text-gray-700 border-gray-300';
    case 'Returned':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

/**
 * Returns Tailwind CSS styling classes for order status badges
 */
export const getOrderStatusBadgeClass = (status) => {
  switch (status) {
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Shipped':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Delivered':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

/**
 * Returns Tailwind CSS styling classes for payout status badges
 */
export const getPayoutStatusBadgeClass = (status) => {
  switch (status) {
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Approved':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Rejected':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};
