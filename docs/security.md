# Security posture

Audit and hardening done on 2026-11-14 for the GitHub App and AWS account `318205107378`
(profile `dsylvesteriii`).

## GitHub App `dsylvester-activity`

- Installed once, on the personal account `DavisSylvester` only. It is in no organization.
- Permissions are read-only: `contents: read` and `metadata: read`. It has no Administration,
  organization or write permission, so it cannot create, change or delete any repository.
- The only webhook event the code uses is `push`.
- The private key lives in the Secrets Manager secret `gh-app-github-app-prod`. Only the
  activity Lambda's role is granted read on it.

Check the live permissions with an App JWT: `GET /app` and `GET /app/installations/{id}`.

## Deploy path

Every push to `main` deploys through GitHub Actions. The OIDC role `gh-app-github-deploy-prod`
can assume the CDK bootstrap roles, which hold `AdministratorAccess`. Anyone who can push to
`main` can therefore act as an account administrator.

- `main` is protected by the repository ruleset `protect-main` (id 27278574). It requires a PR
  with one approval, and blocks force-pushes and branch deletion. The repository admin
  role can bypass it.
- Collaborator `2advancesolutions` keeps write access but can only change `main` through a PR
  the owner approves.

## AWS account

| Item | State |
|---|---|
| Root MFA | On |
| Root access key | Unused; delete it from the root sign-in (Security credentials) |
| `dsylvester` access keys | One, `...R3BA`, used by this machine. The unused `...FYX7` was deleted on 2026-11-14 |
| `dsylvester` MFA | Add it in the IAM console |
| CloudTrail | Trail `gh-app-cloudtrail-prod` → bucket `gh-app-cloudtrail-logs-prod` (all regions, file validation, 365-day retention). Defined in `infrastructure/cdk/lib/audit-trail.ts` |
