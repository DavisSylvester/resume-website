# Activity insights: build plan

Extends `/activity` with seven new views. All of them are computed by the activity API from GitHub data the App can read, and stored in the existing snapshot.

| View | Question it answers for a recruiter |
|---|---|
| Infrastructure as code | How much Terraform vs AWS CDK (and Bicep, Pulumi, CloudFormation/SAM, Serverless) do I write, and for which clouds? |
| Stack fingerprint | Which frameworks and platforms do I actually ship with? |
| How I commit | What is my mix of features, fixes, refactors, tests and docs? |
| Testing discipline | How much of my work touches tests? |
| Pull requests | How many PRs do I open and merge, and how fast do they merge? |
| CI/CD | How often do my pipelines run, succeed and deploy? |
| Career arc | How has my output grown year over year since joining GitHub? |

## Data model: a commit ledger

The core change is a **commit ledger**. For every commit I authored in the 12-month window, the API fetches the commit's file list once (`GET /repos/{repo}/commits/{sha}`) and stores a compact, classified record:

```
pk=COMMIT  sk=<iso date>#<sha>
{ sha, repo, isPrivate, date, type, isMerge,
  lines: { terraform, cdk, bicep, pulumi, cloudformation, serverless, test, source, docs, ci } -> { add, del, files } }
```

- No commit message, file name or private repository name is stored. Private commits keep only their repository id, date, type and line counts.
- Records expire 400 days after the commit (DynamoDB TTL).
- IaC, testing and commit-type views are all aggregations over this ledger, so they share one fetch per commit.

Per-repository scan results are cached and recomputed only when the repository's `pushedAt` changes:

```
pk=REPO  sk=<owner/name>
{ pushedAt, isPrivate, cdkRoots, pulumiRoots, samRoots, serverlessRoots,
  frameworks, providers, clouds, testBytes, codeBytes, scannedAt }
```

## File classification

| Class | Rule |
|---|---|
| Terraform | `*.tf`, `*.tfvars`, `*.tf.json`, `.terraform.lock.hcl` (not under `.terraform/`) |
| AWS CDK | Under a directory containing `cdk.json`, or a `package.json` that depends on `aws-cdk-lib` |
| Bicep | `*.bicep`, `*.bicepparam` |
| Pulumi | Under a directory containing `Pulumi.yaml` |
| CloudFormation / SAM | Under a directory containing `samconfig.toml`, or file names containing `cloudformation`/`cfn` |
| Serverless | Under a directory containing `serverless.yml` / `serverless.ts` |
| Test | `__tests__/`, `test/`, `tests/`, `spec/`, `e2e/`, `*.test.*`, `*.spec.*`, `*_test.go`, `test_*.py`, `*Tests.cs` |
| CI | `.github/workflows/`, `azure-pipelines*`, `buildspec*`, `Jenkinsfile` |
| Docs | `*.md`, `docs/` |
| Excluded | Lock files, `node_modules/`, `dist/`, `build/`, `cdk.out/`, `*.min.*` |
| Source | Everything else |

**Clouds** come from Terraform providers (`.terraform.lock.hcl`, then `provider` / `required_providers` blocks), plus fixed mappings: CDK, SAM and Serverless are AWS, Bicep is Azure, and Pulumi is detected from `@pulumi/aws|azure-native|gcp`.

**Frameworks** come from manifests: `package.json`, `pubspec.yaml`, `*.csproj`, `requirements.txt` / `pyproject.toml`, `go.mod` and `Cargo.toml`. A fixed map turns dependencies into named frameworks with a category: frontend, backend, mobile, cloud, data/AI or testing.

**Commit type** comes from the Conventional Commit prefix (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`, `style`, `revert`). Merges count as `merge` and anything else counts as `other`.

## Other sources

| View | Source | Refresh |
|---|---|---|
| Pull requests | GraphQL `search(type: ISSUE, "is:pr author:<me> created:>=<from>")` for opened, merged and time to merge; reviews from `contributionsCollection` | Hourly |
| CI/CD | `GET /repos/{repo}/actions/runs?actor=<me>&created=>=<from>` per repository; workflows named or pathed `deploy\|release\|publish\|cd` count as deploys | Daily |
| Career arc | One GraphQL query with one aliased `contributionsCollection` per calendar year since `user.createdAt` | Daily |

## Refresh flow and budgets

- **Hourly schedule:** contributions (as today), then the insights increment.
  - Scan repositories whose `pushedAt` changed.
  - List my commits per changed repository.
  - Fetch details for at most **300 new commits** per run, 6 at a time, and stop early if the rate limit falls below 500.
  - Re-aggregate and save the snapshot.
  - The first backfill of about 3,000 commits completes over roughly 10 runs.
- **Push webhook:** the handler now only verifies, stores the live event and enqueues the pushed SHAs. It then asynchronously invokes its own Lambda, which classifies those commits (at most 50) and refreshes the snapshot. This keeps the webhook response well under GitHub's 10-second limit and makes the IaC numbers update within seconds of a push.
- **Lambda:** the timeout goes from 60 s to 300 s and memory from 512 MB to 1024 MB. API requests still only read the snapshot.

## Privacy

| Data | Public repositories | Private repositories |
|---|---|---|
| Repository name in any list | Yes | Never |
| Commit messages | Live feed only (as today) | Never stored |
| Counts, lines, types, frameworks, clouds | Yes | Yes, aggregated only |

## GitHub App permissions

| Permission | Status | Needed for |
|---|---|---|
| Contents: read, Metadata: read | Already granted | Ledger, scans, manifests, providers, career |
| **Pull requests: read** | New | Private-repository PRs. Public PRs work without it. |
| **Actions: read** | New | Private-repository workflow runs. Public runs work without it. |

The user adds the two permissions in the App settings and accepts the update on the installation. Until then, those views show public data only and are labelled accordingly. `scripts/register-github-app.mts` is updated so a re-created App gets them by default.

## Build order

1. **Pure logic with unit tests:** file classification, commit-type parsing, framework and provider detection, deploy detection, aggregation.
2. **Storage:** ledger, repository-scan and pending-SHA items in DynamoDB, with an in-memory twin for tests and local dev.
3. **Collector:** repository tree, manifests, Terraform providers, commit list and details, PR search, Actions runs, career years. The client exposes the remaining rate limit.
4. **Insights service:** incremental refresh with budgets, pending-push processing and aggregation into `snapshot.insights` (optional in the schema, so older snapshots stay valid).
5. **Webhook:** enqueue plus asynchronous self-invoke.
6. **UI:** two reusable d3 components (stacked columns, horizontal bars) and seven cards, each with a table view and tooltips.
7. **Infrastructure:** Lambda timeout and memory, and permission for the function to invoke itself.
8. **Verification:**
   - Type-check, lint and unit tests.
   - A local collection against real GitHub with a gh token.
   - A browser check at desktop and phone widths.
   - Deploy, App permission update, backfill, and a check on the live site.
