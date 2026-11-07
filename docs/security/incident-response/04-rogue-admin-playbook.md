# Incident Response Playbook 04: Rogue Admin & Privilege Abuse

> **Severity**: P1 (Critical)  
> **Trigger Events**: `SEC_AUTHZ_PRIVILEGE_ESCALATION`, `SEC_AUTHZ_ADMIN_ROUTE_BLOCKED`, `SEC_AUTH_STEPUP_FAILED`  
> **Target Asset**: Admin Portal (`/api/admin/*`), User Roles, Settlement Overrides  

---

## 1. Threat Scenarios
- Compromise of an administrative credential.
- An insider administrator attempting unauthorized COD remittance release or user role elevation.
- Repeated step-up authentication failures during sensitive operations (e.g. manual COD settlement).

---

## 2. Containment Procedure (Immediate Actions)
1. **Deactivate Rogue Admin Account**:
   ```sql
   UPDATE "Users"
   SET "IsActive" = false, "TokenVersion" = "TokenVersion" + 1
   WHERE "Id" = @SuspectAdminId;
   ```
2. **Revoke All Active Sessions**:
   ```sql
   UPDATE "RefreshTokens"
   SET "RevokedAt" = NOW(), "RevokeReason" = 'RogueAdminContainment'
   WHERE "UserId" = @SuspectAdminId;
   ```
3. **Emergency Admin Portal Kill-Switch**:
   If pervasive administrative compromise is suspected:
   Set `Admin:WebEnabled = false` in application configuration and reload Kestrel.
   *Result*: All administrative routes immediately return 404 Not Found to all callers.

---

## 3. Forensic Investigation
1. Query `AdminAuditLogs` for all actions taken by the compromised ID during the last 30 days:
   ```sql
   SELECT "Timestamp", "Action", "EntityType", "EntityId", "Details"
   FROM "AdminAuditLogs"
   WHERE "AdminId" = @SuspectAdminId
   ORDER BY "Timestamp" DESC;
   ```
2. Revert any unauthorized user status changes, wallet credit adjustments, or review hide/unhide operations.
3. Reset all administrative passwords and enforce TOTP 2FA re-enrollment across the administrative team.
