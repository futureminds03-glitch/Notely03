# Security Policy

## Supported development line

The current development line is main and the product is pre-1.0. This is not an enterprise support or guaranteed response-time commitment.

## Reporting a vulnerability

Report suspected vulnerabilities privately to the repository owner/maintainers through GitHub's private vulnerability reporting feature, if enabled, or another private channel already established with the maintainers. Do not publish credentials, personal note content, or a working exploit in a public issue.

Include:
- A concise description and affected component.
- Reproduction steps using a non-production test account and non-sensitive sample data.
- Potential impact and practical mitigation.

## Security-sensitive areas

- **Authentication and authorization:** Supabase sessions, per-user note access, and database row-level security.
- **Secrets:** Groq API key and Supabase server-side credentials/configuration.
- **Server-side URL fetching:** link preview and lib/safe-url-fetch.ts; SSRF protections, redirects, DNS/address validation, timeouts, and response-size limits.
- **User content:** note bodies and history should not leak into logs or analytics.
- **Dependencies and deployments:** lockfile integrity, CI permissions, Vercel environment variables, and production configuration.

## Secret-handling rules

- Never commit production secrets or real user data.
- Keep GROQ_API_KEY server-only.
- Only expose Supabase publishable/anonymous credentials through public variables; never expose a service-role key to the browser.
- Rotate a secret immediately if it is accidentally exposed, and review relevant logs and deployment history.
- Use least-privilege access for database policies and integrations.

## Disclosure and remediation

Validate reports, assess impact, fix the root cause, add regression coverage, and verify the production deployment before describing an issue as resolved. Do not disable authentication, validation, or security checks as a workaround.
