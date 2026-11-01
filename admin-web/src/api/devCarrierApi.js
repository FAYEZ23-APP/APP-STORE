import client from './client';

export const updateCarrierShipmentStatus = (shipmentId, status, returnReason = null) => {
  return client.put(
    `/dev/carrier/shipments/${shipmentId}/status`,
    { status, returnReason },
    {
      headers: {
        'X-Carrier-Dev-Secret': 'dev-carrier-secret',
      },
    }
  );
};

export const settleCarrierCod = (shipmentId) => {
  return client.post(
    `/dev/carrier/shipments/${shipmentId}/settle-cod`,
    {},
    {
      headers: {
        'X-Carrier-Dev-Secret': 'dev-carrier-secret',
      },
    }
  );
};

export default {
  updateCarrierShipmentStatus,
  settleCarrierCod,
};
