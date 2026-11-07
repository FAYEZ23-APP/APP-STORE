# Incident Response Playbook 01: Stolen Refresh Token & Session Compromise

> **Severity**: P1 (Critical)  
> **Trigger Event**: `SEC_AUTH_TOKEN_REUSE_DETECTED`  
> **Target Asset**: User Authentication & Active Sessions  
> **Legal Reference**: Egyptian Personal Data Protection Law 151/2020  

---

## 1. Trigger Conditions & Immediate Detection
- An already consumed refresh token is presented to `/api/auth/refresh-token`.
- This condition occurs when an attacker intercepts an in-flight token and attempts to refresh it after the legitimate client already rotated it (or vice-versa).

## 2. Automated Containment (Phase 1 — Zero Human Delay)
The backend executes the following operations in a single database transaction:
1. Revoke the entire token family (`FamilyId`) associated with the compromised token:
   `UPDATE "RefreshTokens" SET "RevokedAt" = NOW(), "RevokeReason" = 'ReuseDetected' WHERE "FamilyId" = @FamilyId;`
2. Increment `User.TokenVersion`:
   `UPDATE "Users" SET "TokenVersion" = "TokenVersion" + 1 WHERE "Id" = @UserId;`
   *Result*: Immediately invalidates all existing JWT access tokens for that user across all devices.
3. Log critical event `SEC_AUTH_TOKEN_REUSE_DETECTED` with Client IP, User Agent, and timestamp.

## 3. Incident Commander Triage (Phase 2 — Within 30 Minutes)
1. **Identify the affected user**: Query user role (Buyer, Seller, or Administrator).
2. **Review IP and Geo-location**:
   - Legitimate client IP vs Attacker IP.
   - If User Role is `Admin` or `Seller`: Escalate to Executive Incident Commander immediately.
3. **Notify User**:
   - Send transactional security email to the user's registered email address:
     *"Your session was automatically terminated due to suspicious activity. Please reset your password to re-enable access."*

## 4. Eradication & Remediation (Phase 3)
1. Require immediate password reset upon next login attempt.
2. Invalidate any pending password reset tokens or unverified OTPs for that user.
3. If compromised account is a Seller, temporarily pause pending payout requests until identity is confirmed.

## 5. Post-Incident Review (Phase 4)
- Analyze access logs for 24 hours prior to the reuse event.
- Confirm whether unauthorized orders or address changes were made during the active session.
- Document incident timeline in the security incident tracker.
