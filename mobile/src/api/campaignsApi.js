import client from './client';

/**
 * Fetch active promotional and editorial hero campaigns ordered by priority.
 * Public endpoint consumed by mobile homepage and web storefront.
 */
export const getActiveCampaigns = () => client.get('/campaigns');
