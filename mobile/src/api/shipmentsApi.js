import client from './client';

/**
 * Shipments API client (one shipment per seller per order)
 */

// List shipments belonging to current seller
export const getSellerShipments = () => 
  client.get('/shipments/seller');

// Update shipment status (e.g. HandedToCarrier)
export const updateShipmentStatus = (shipmentId, status) => 
  client.put(`/shipments/${shipmentId}/status`, { status });
