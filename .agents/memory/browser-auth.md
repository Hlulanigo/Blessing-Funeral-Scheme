---
name: Browser authentication
description: The browser sign-in experience and staff authorization boundary for the funeral scheme app.
---

The browser uses the hosted OIDC flow for both existing-user login and new-user registration; the app should not add a local password form. Authentication establishes identity, while staff records determine workspace access.

**Why:** This keeps credentials and PKCE validation outside the app and preserves the existing staff directory as the source of authorization.

**How to apply:** Keep auth redirects and session loading in the shared browser auth package, show a single login-or-register entry point, and preserve staff linking/authorization in the API layer.