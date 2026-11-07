# Incident Response Playbook 02: Personal Data Breach & Regulatory Notification

> **Severity**: P1 (Critical)  
> **Trigger Event**: Confirmed or suspected unauthorized access, exposure, or exfiltration of customer PII  
> **Statutory Compliance**: Egyptian Personal Data Protection Law 151/2020 (Articles 7 & 8) & Executive Regulations Decree 816/2025  

---

## 1. Statutory Obligations & Deadlines
Under Article 7 of Law 151/2020:
- **Mandatory Notification to Data Protection Center (DPC - مركز حماية البيانات الشخصية)**: Within **72 hours** of becoming aware of the breach.
- **Mandatory Notification to Affected Data Subjects (المعنيون بالبيانات)**: Within **3 business days** if the breach poses a risk to their rights or personal security.

---

## 2. Phase 1: Immediate Triage & Containment (0 - 4 Hours)
1. **Isolate the vector**:
   - If SQL injection: Patch vulnerability or take endpoint offline via Cloudflare / WAF rule.
   - If S3 / storage leak: Revoke public ACLs on storage buckets immediately.
   - If credential compromise: Rotate compromised administrative or database credentials.
2. **Preserve Digital Forensics**:
   - Snapshot server memory, access logs, and PostgreSQL transaction logs.
   - DO NOT overwrite or delete logs.

---

## 3. Phase 2: Forensic Impact Assessment (4 - 24 Hours)
1. **Identify Data Categories Exposed**:
   - Basic PII: Names, emails, delivery addresses, phone numbers.
   - Sensitive PII: National ID (الرقم القومي), commercial registries, dispute documents.
   - Financial Data: Escrow records, wallet transaction history.
2. **Quantify Scope**: Number of affected Egyptian citizens and corporate sellers.
3. **Determine Encryption Status**:
   - Confirm passwords were encrypted with BCrypt (Work Factor 11).
   - Confirm TOTP 2FA secrets were encrypted at rest with AES-GCM-256.

---

## 4. Phase 3: Regulatory Notification Dossier (Within 72 Hours)
Draft and submit the official notification to the Egyptian Data Protection Center including:
1. Description of the nature of the personal data breach.
2. Categories and approximate number of data subjects concerned.
3. Name and contact details of the Data Protection Officer (DPO / مسؤول حماية البيانات الشخصية).
4. Likely consequences and severity of the breach.
5. Remedial measures taken or proposed to mitigate potential adverse effects.

---

## 5. Phase 4: Data Subject Notification
Send clear, non-technical bilingual communication (Arabic primary, English secondary) to affected individuals via email and SMS:
- Clear description of the incident.
- Recommendations for user safety (e.g. change passwords, watch for phishing).
- Dedicated support channel contact info.
