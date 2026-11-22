# ACE-MED Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Verified Identity**: Every read or write requires a verified Google account (`request.auth != null && request.auth.token.email_verified == true`).
2. **RBAC Isolation**: Only the bootstrapped admin (`hugoac.bedo@gmail.com`) or explicitly admin-approved staff (`users/{uid}.approved == true`) may access clinical shift collections (`patients`, `shift_config`, `audit_logs`).
3. **PII Isolation (`users/{userId}`)**: A staff member may only `get` their own profile; only `isAdmin()` may `list` or approve other staff profiles. Users cannot self-assign `role: 'admin'` or `approved: true` (except the verified bootstrapped admin email).
4. **Permanent Supervisor**: `shift_config/current` always enforces `responsableGuardia == 'HUGO ALBERTO ACEBEDO CRUZ'` and can only be mutated by authorized staff (`whatsappGroupUrl`, `incluirCamposVaciosEnMensaje`) without altering `responsableGuardia` or `workspaceId`.
5. **Optimistic Concurrency**: Every patient document starts at `version == 1` on `create` and strictly increments `version == existing().version + 1` on `update` to prevent silent cross-device overwrites.
6. **Immutable Fields & Temporal Integrity**: `createdAt`, `createdByUid`, `createdByEmail`, `id`, and `workspaceId` are immutable after creation; `createdAt` (on create) and `updatedAt` (on create/update) must equal `request.time`.
7. **Append-Only Audit Trail**: `audit_logs/{logId}` documents can never be updated or deleted (`allow update, delete: if false`).

## 2. The "Dirty Dozen" Attack Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Reading `/patients/{id}` with `request.auth == null`.
2. **Unverified Email Spoof**: Accessing `/patients` with `email: "hugoac.bedo@gmail.com"` and `email_verified: false`.
3. **Privilege Escalation on Create**: Non-admin creating `/users/{uid}` with `{ role: "admin", approved: true }`.
4. **Privilege Escalation on Update**: Approved staff updating `/users/{uid}` to set `role: "admin"`.
5. **PII Cross-Read**: Non-admin user reading `/users/{otherUid}` or listing `/users`.
6. **Shadow Field Injection**: Creating/updating `/patients/{id}` with extra field `{ isVerified: true }`.
7. **ID Poisoning**: Creating `/patients/../../../etc` or a 200-char document ID.
8. **Value Poisoning (Denial of Wallet)**: Updating `/patients/{id}` with a 50KB `observaciones` string or invalid `estadoEgreso: "hacked"`.
9. **Identity Spoofing**: Creating `/patients/{id}` with `createdByUid: "another_uid"`.
10. **Concurrency Version Bypass**: Updating `/patients/{id}` without incrementing `version` (`version: existing.version`).
11. **Timestamp Forgery**: Creating `/patients/{id}` with a backdated client timestamp instead of `request.time`.
12. **Audit Log Tampering**: Updating or deleting an existing document in `/audit_logs/{logId}`.

## 3. Access Requests Invariants & Adversarial Checks (`/access_requests/{userId}`)
- **Exclusive Governance**: Only `isPrimaryAdmin()` (`hugoac.bedo@gmail.com` with `email_verified == true`) may list all requests, approve/reject requests, manage `/users/{userId}` roles/approvals, or revoke access.
- **Single Pending Request**: Document ID is fixed to `request.auth.uid`; owner cannot update while `status == 'pendiente'` and cannot create/re-submit while already approved in `/users/{uid}`.
- **Re-submission After Rejection or Revocation**: Unapproved owner may transition `rechazada` or `aprobada` (after access revocation) back to `pendiente`, clearing review fields and stamping `request.time`.
- **Anti-Self-Approval & Privacy**: Owner cannot set `status` to `aprobada`/`rechazada` or set `assignedRole`; access-control audit logs (`approve_access_request`, `reject_access_request`, `revoke_staff_access`, `update_staff`) require `isPrimaryAdmin()` and `patientId == ''`.
- **Additional Denied Payloads**:
  13. Non-primary-admin listing `/access_requests` or reading `/access_requests/{otherUid}`.
  14. Non-primary-admin creating `/access_requests/{uid}` with `status: "aprobada"` or spoofed `email`.
  15. Non-primary-admin updating their own `/access_requests/{uid}` from `pendiente` to `aprobada`.
  16. Non-primary-admin user with `role: "admin"` attempting to approve requests or update `/users/{otherUid}`.

