# Security Policy

Glass Pay's member app, community dashboard and platform-admin panel live in
this repository. It is a **frontend-only** application — there is no backend,
database or migration code here. The API, the ledger, Paystack, Smile ID and
the email/SMS providers are separate systems owned by the backend team.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security vulnerability.

Report privately, using whichever channel suits you:

- **GitHub private vulnerability reporting** — the _Security_ tab →
  _Report a vulnerability_ on this repository. This is the preferred channel:
  it opens a private thread with the maintainers and keeps the conversation
  attached to the fix.
- **Email** — `glasspayhq@gmail.com`, with the details below.

Please include:

- A description of the vulnerability and what an attacker gains
- Steps to reproduce (a route, a payload, a sequence of clicks)
- The affected file or route, if you know it
- Any proof-of-concept, screenshots or logs you already have

You will get an acknowledgement within **48 hours** and a status update at
least every few days until the report is closed.

## What counts as a vulnerability

Something an attacker could exploit **against Glass Pay or its users** — for
example:

- Authentication or session-handling bypass, or a way to act as another user
- Privilege escalation — reaching an admin surface or API a normal member
  cannot
- Exfiltration of credentials, tokens, personal data or payment data
- An injection that executes attacker-controlled code in another user's browser
  (XSS, including via a stored URL or image field)
- A weakness in the CSP, cookie handling, or a security header that defeats a
  control the app relies on
- A client-side check that the backend does not actually enforce, presented as
  if it were a security boundary

The frontend guards and route checks are UX routing, not a security boundary
— the backend is authoritative for permissions. Reporting "I reached the
admin UI without a role" is usually not a vulnerability on its own; it becomes
one if the backend then acts on the request.

## Out of scope

- Findings that need physical access to an unlocked device
- Denial of service or resource exhaustion
- Automated scanners with no demonstrated impact, and missing hardening headers
  with no exploit path
- Reports against a third-party service (report those to the provider)
- **Anything in the backend, the API, or the infrastructure.** This repository
  does not contain them. If the issue is server-side, say so in the report and
  we will route it to the backend team.

## Safe harbour

We welcome security research on this application. If your report is made in
good faith, does not degrade the service for other users, does not access
other users' data beyond what is needed to demonstrate the issue, and does not
exfiltrate data for other purposes, we will not pursue legal action against
you for the research.

Do not:

- Access data that is not yours, or attempt to access it beyond proving the
  issue
- Degrade availability, or run automated load against the production app
- Use social engineering, physical attacks, or third-party infrastructure
- Disclose the issue publicly before we have had a reasonable chance to fix it

## Security-relevant repository settings

These are configured on the repository and are worth knowing about when you
report something:

- **Secret scanning and push protection** are enabled, so a leaked credential
  is blocked at push time and flagged in the repository.
- **Private vulnerability reporting** is enabled (see above).
- **Dependabot** runs weekly for npm, and weekly for `github-actions` — the
  latter is what keeps the SHA-pinned workflow actions current. Security
  updates are applied separately from routine version bumps.
- **CodeQL** runs on every push and pull request. Alerts are triaged as part
  of the normal review flow; the rationale for an accepted alert is recorded
  in `docs/decisions/` so a decision is never silently dropped.
- **Branch protection is not enabled on `main`** (`protected: false`, and no
  repository rulesets). The "pull request plus a green CI run" rule is a team
  convention, not a GitHub-enforced setting, so a direct push to `main` is not
  blocked by GitHub today. Treat the CI gates as the real control until
  protection is turned on.

## Security documentation

- `docs/decisions/ADR-002-auth-storage.md` — where session tokens are stored
  and why, and the conditions for moving them to `HttpOnly` cookies
- `docs/authentication.md` — the session lifecycle, refresh and role rules
- `docs/authorization.md` — what the frontend guards do and do not promise
- `docs/runbooks/incident-rollback.md` — what to do when something is wrong
  in production, including the payments kill switch
