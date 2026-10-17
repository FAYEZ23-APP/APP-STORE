import client from './client';

/**
 * Validate and preview discount for items in cart
 * @param {{ code: string, items?: Array<{ productId: number, variantId?: number, quantity: number }> }} data
 */
export const validateCoupon = (data) => client.post('/coupons/validate', data);

/**
 * Create a new coupon (Sellers)
 * @param {{
 *   code: string,
 *   discountType: 'Percentage' | 'FixedAmount',
 *   discountValue: number,
 *   minOrderSubtotal: number,
 *   maxDiscountAmount?: number,
 *   maxUsage: number,
 *   perUserLimit: number,
 *   expiresAt: string
 * }} data
 */
export const createCoupon = (data) => client.post('/coupons', data);

/**
 * Get coupons created by current seller
 */
export const getMyCoupons = () => client.get('/coupons/my');
