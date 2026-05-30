# Security Specification: Spirit Alchemist costing

## 1. Data Invariants
- Any recipe or ingredient document must have a valid `tenantId`.
- Only `superadmin` users can write, edit, or delete collections/documents marked with `tenantId: "global"`.
- Clients can only read, write, or delete ingredients or recipes that belong to their specific `tenantId` (as verified in `/users/{userId}`). They can also read items with `tenantId: "global"`.
- Temporal integrity: All database creations/updates must enforce `createdAt` or `updatedAt` to match the server-provided `request.time`.
- Immutable fields: Once created, `id`, `tenantId`, and `creatorId` (if present) are immutable and cannot be changed.

## 2. The "Dirty Dozen" Malicious Payloads
Here are 12 malicious payloads designed to attempt to break the rules, all of which must return `PERMISSION_DENIED`:

1. **Privilege Escalation via Self-assigned Admin:** An authenticated client attempts to write `/users/{userId}` with `role: "superadmin"`.
2. **Global Ingredient Hijacking (Edit):** An authenticated client attempts to update a global ingredient `/ingredients/global-sugar` to set its `baseCost` to dummy values.
3. **Global Recipe Hijacking (Edit):** An authenticated client attempts to overwrite the master recipe `/recipes/global-mojito`.
4. **Cross-Tenant Document Read (Get):** Client A (`tenantId: rest-1`) attempts to read a recipe document from Client B (`tenantId: rest-2`).
5. **Cross-Tenant Document Write (Create):** Client A attempts to write a recipe document with `tenantId: rest-2`.
6. **Cross-Tenant Document Update (Spoof):** Client A attempts to modify Client B's recipe to inject malicious values.
7. **Identity Spoofing on Create:** An unauthenticated user attempts to write a user profile or ingredient.
8. **Resource Poisoning (Junk Property Injection):** A client attempts to write or update a document with invalid keys, e.g., `"attackerJoinedField": true`.
9. **Denial of Wallet (Huge Payload):** A user attempts to write a Name string larger than 500 characters.
10. **State Shortcutting / Bypass Key Locking:** An update is sent that bypasses the validation schema or skips mandatory keys.
11. **Timestamp Spoofing:** A client attempts to supply a manual, stale client-side timestamp for `updatedAt` to circumvent temporal tracking.
12. **Foreign Foreign-Key reference injection:** A user attempts to create a recipe that references non-existent ingredients or references items they don't have access to.

## 3. Security Rule Layout
The active rules will be written to `firestore.rules` and verified via standard flat flat-rate security paradigms.
