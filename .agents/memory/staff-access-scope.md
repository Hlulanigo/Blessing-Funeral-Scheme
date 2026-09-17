---
name: Staff access scope
description: Staff management currently covers directory records and administrative status, not authentication.
---

The staff directory is intentionally record-based for now; adding a staff member creates an invited staff record, while secure sign-in and invitation acceptance remain a separate follow-up.

**Why:** The existing app did not have an authentication flow, and the immediate request was to add and manage staff without introducing account provisioning assumptions.

**How to apply:** Preserve the staff API and status model when adding authentication. Link authenticated identities to existing staff records instead of replacing the directory.