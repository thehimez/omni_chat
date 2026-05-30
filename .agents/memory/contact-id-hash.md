---
name: Xanda contact ID generation
description: How contact IDs are generated and why MD5 must be used consistently in both Node.js and SQL.
---

## Rule
Contact IDs are `contact_` + MD5(userId + "_" + normalizedDisplayName).

Normalized display name = `name.trim().toLowerCase().replace(/\s+/g, " ")`.

In Node.js (contact-linker.ts): `createHash("md5").update(s).digest("hex")`
In Postgres (backfill SQL): `MD5(user_id || '_' || LOWER(TRIM(REGEXP_REPLACE(contact_name, '\s+', ' ', 'g'))))`

Both produce the same 32-char lowercase hex string.

**Why:** The first backfill attempt used a JS stableHash (base-36 CRC32) which produced different IDs than any SQL-based backfill would. This left orphan contacts when a SQL bulk backfill ran. Switching to MD5 in both places keeps IDs consistent regardless of which path creates the contact.

**How to apply:** Any time you write a contact-creation query in SQL (migrations, one-off scripts, admin tools), use `'contact_' || MD5(user_id || '_' || LOWER(TRIM(...)))`. The contact-linker.ts already does this via crypto.createHash('md5').
