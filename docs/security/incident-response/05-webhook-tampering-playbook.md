# Incident Response Playbook 05: Carrier Webhook Spoofing & Delivery Tampering

> **Severity**: P1 (Critical)  
> **Trigger Events**: `SEC_INTEGRATION_WEBHOOK_TAMPERED`, `SEC_INTEGRATION_SSRF_BLOCKED`  
> **Target Asset**: Carrier Webhook Receiver (`/api/webhooks/bosta`), Shipment State Transitions  

---

## 1. Threat Scenarios
- Attacker attempting to forge `Delivered` status transitions without physical delivery to trigger escrow releases.
- Attacker attempting to brute-force or bypass HMAC-SHA256 signatures on webhook callbacks.
- Replaying old webhook payloads to re-credit merchant pending balances or re-stock inventory.

---

## 2. Immediate Containment
1. **Automated Defenses Verified**:
   - The system automatically rejects requests with invalid or missing HMAC signatures with `401 Unauthorized`.
   - Webhook timestamp validation rejects requests with clock skew > 5 minutes (`400 Bad Request`).
   - Duplicate external provider event IDs are acknowledged idempotently with no database state change.
2. **If Repeated HMAC Failures Occur (> 10 failures in 10 minutes)**:
   - Identify source IP address from `SEC_INTEGRATION_WEBHOOK_TAMPERED` events.
   - Block malicious IP address at the firewall / reverse proxy (Nginx or Cloudflare WAF).
   - If Bosta webhook secret is suspected to be leaked:
     1. Generate a new secret in the Bosta Developer Portal.
     2. Update `Bosta:WebhookSecret` in production secrets manager.
     3. Restart backend service.

---

## 3. Financial Re-Verification
Run verification script to ensure no unauthorized shipment transitions were effected:
```sql
SELECT s."Id", s."TrackingNumber", s."Status", s."IsCodSettled", s."UpdatedAt"
FROM "Shipments" s
WHERE s."Status" = 2 -- Delivered
  AND s."UpdatedAt" >= NOW() - INTERVAL '1 hour'
  AND s."CarrierDeliveryConfirmedAt" IS NULL;
```
If any unconfirmed shipments exist, freeze associated COD settlements.
