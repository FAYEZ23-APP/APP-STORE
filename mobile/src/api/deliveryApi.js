import client from './client';

/**
 * Delivery API client for Egyptian market
 */

// Search supported Egyptian cities (القاهرة, الجيزة, الإسكندرية, etc.)
export const getDeliveryCities = (query = '') => 
  client.get('/delivery/cities', { params: query ? { query } : {} });

// Get pickup points for a city (e.g., Cairo, Giza branches)
export const getPickupPoints = (city = '') => 
  client.get('/delivery/pickup-points', { params: city ? { city } : {} });

// Calculate per-seller delivery quote (cost, ETA, per-seller parcels)
export const calculateDeliveryQuote = (data) => 
  client.post('/delivery/quote', data);
