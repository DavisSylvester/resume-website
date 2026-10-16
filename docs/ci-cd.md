# CI/CD

Every push to `main` is tested and deployed by GitHub Actions (`.github/workflows/deploy.yml`). Pull requests run the tests only. Nobody needs to run `cdk deploy` or the UI upload script by hand.

## Pipeline

| Job | Runs on | Steps |
|---|---|---|
| Test and build | Every push and PR | Activity API type-check, ESLint and `bun test`. UI production build. CDK type-check. |
| Deploy to AWS | Push to `main` and manual runs | OIDC sign-in, `cdk deploy CdkStack`, site upload to both buckets with CloudFront invalidation, smoke test |

- Only one deploy runs at a time. A newer push waits for the running deploy instead of cancelling it.
- **Manual run:** Actions, then Deploy, then "Run workflow".

## AWS access: OIDC, no stored keys

The deploy job requests a short-lived GitHub OIDC token and assumes the IAM role `gh-app-github-deploy-prod` in account 318205107378. No AWS secret is stored in GitHub.

| Control | Setting |
|---|---|
| Trust | Only `repo:DavisSylvester/resume-website:ref:refs/heads/main`, audience `sts.amazonaws.com` |
| CDK | `sts:AssumeRole` on the CDK bootstrap roles (`cdk-hnb659fds-*`). CloudFormation does the actual changes with the bootstrap execution role. |
| Site | `s3:ListBucket`, `GetObject` and `PutObject` on `davis-resume-spa` and `davis-resume-spa2`, plus `cloudfront:CreateInvalidation` on their two distributions |
| Session | 1 hour maximum |

The role is defined in `infrastructure/cdk/lib/cicd-stack.ts` as the separate stack `GhAppCicdStack`. CI deploys only `CdkStack`, so the pipeline can never widen its own permissions.

- **To change the role:** deploy `GhAppCicdStack` from a workstation:
  ```sh
  cd infrastructure/cdk && npx cdk deploy GhAppCicdStack
  ```
  The profile and account are pinned in `cdk.json`.
- **Pinned profile:** `cdk.json` and `src/ui/scripts/deploy-ui.sh` pin the AWS profile `dsylvesteriii`. CI writes the OIDC session into a profile with that name, so the same commands work locally and in CI.

## What is still manual

| Action | Why |
|---|---|
| Changing `GhAppCicdStack` | It is the trust root for CI, so it is deliberately not self-deploying. |
| GitHub App permission changes | GitHub requires the account owner to re-authenticate (sudo mode). |
