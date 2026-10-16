# GitHub activity page (`/activity`)

A live, d3-driven view of what I ship on GitHub, built for recruiters and hiring managers.
Data comes from a **GitHub App** installed on my account. Pushes arrive in real time
through the App's webhook. The App's installation token reads the contribution graph
with GraphQL.

## Why a GitHub App

| Need | How the App covers it |
|---|---|
| Real-time updates | App webhooks deliver a `push` event within seconds of every push to any repository the App is installed on. |
| Least privilege | Permissions are only `contents: read` and `metadata: read`, and the only event is `push`. The App is private to my account. |
| No personal token in the stack | The backend signs a 9-minute RS256 JWT with the App's private key and exchanges it for a 1-hour installation token. Both are cached in the warm Lambda. |
| Headline private count | `contributionsCollection.restrictedContributionsCount` returns private contribution counts. My profile has "Include private contributions" turned on, so this number is already public. |

## Architecture

```
GitHub ──push webhook──▶ API Gateway ──▶ Lambda (Bun + Elysia) ──▶ DynamoDB
                         POST /webhooks/github        │  verify X-Hub-Signature-256 (HMAC, constant time)
                                                      │  store redacted LiveEvent (30-day TTL)
                                                      └─ shallow refresh: 1 GraphQL call, debounced 60 s

EventBridge (hourly) ──▶ Lambda ── deep refresh: GraphQL + REST (commit times, contributor stats)

Browser /activity ──GET /activity/snapshot──▶ Lambda ──▶ DynamoDB
                  ──GET /activity/live?since=<cursor> every 15 s while the tab is visible
```

**Real time is webhook plus short polling.** A push reaches DynamoDB in about a second. An open page sees it on its next poll, within 15 seconds. Polling pauses while the tab is hidden. True push to the browser would need an API Gateway WebSocket API, which costs more moving parts than a 15-second poll is worth for this page.

GitHub can take a few minutes to count a push in the contribution graph. The page therefore refetches the snapshot when a push arrives and once more three minutes later.

## Privacy rules

- Private repositories are never itemised. For a private push the API stores only the commit count, the language and the time. Repository name, branch, URL and commit messages are dropped before storage. A unit test checks this.
- Language totals include private repositories, but only as language names and counts.
- Pushes by anyone other than `GITHUB_LOGIN` are ignored, as are branch deletions.
- Commit times and lines changed come from public repositories only.

**Coverage limit:** the webhook only fires for repositories where the App is installed, which means my personal account. Pushes to an employer's organization do not arrive in real time unless that org installs the App. Those contributions still appear in the headline and the calendar after the next hourly refresh, because GitHub counts them in the profile graph.

## API

All routes are served by `src/api/activity`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/activity/health` | Liveness. Always `{"status":"ok"}`. |
| GET | `/activity/ready` | Readiness. Checks the DynamoDB read path. |
| GET | `/activity/snapshot` | The aggregated snapshot. Returns 404 before the first collection. Cached 30 s. |
| GET | `/activity/live?since=<cursor>` | Pushes newer than the cursor, newest first. Returns `{ events, cursor }`. |
| POST | `/webhooks/github` | GitHub App webhook. Returns 401 on a bad signature and 202 otherwise. |

CORS allows only the origins in `ALLOWED_ORIGINS`.

### Snapshot shape

Defined once as a TypeBox schema in `src/api/activity/src/schemas/activity-snapshot.schema.mts`. The UI mirrors it in `src/ui/src/app/activity/interfaces`.

| Field | Source |
|---|---|
| `totals.contributions`, `totals.privateContributions`, `calendar`, `streak` | GraphQL contribution calendar. Includes private work. |
| `repos` (public only), `languages` | GraphQL `commitContributionsByRepository` |
| `hourOfWeek` | REST commit list per public repo, bucketed in `ACTIVITY_TIMEZONE` |
| `churn`, `totals.linesAdded/Deleted` | REST `stats/contributors` per public repo |

## Deployed resources

| Resource | Name |
|---|---|
| Lambda (container image) | `gh-app-activity-api-prod` |
| DynamoDB table | `gh-app-activity-prod` |
| Secrets Manager secret | `gh-app-github-app-prod` |
| EventBridge hourly rule | `gh-app-activity-refresh-prod` |
| Log group | `/aws/lambda/gh-app-activity-api-prod` |

All resources in the stack are tagged `application = resume-website` and `environment = prod`. Routes are added to the existing HTTP API: `GET|OPTIONS /activity/{proxy+}` and `POST /webhooks/github`.

## Environment

| Variable | Default | Notes |
|---|---|---|
| `GITHUB_LOGIN` | required | Whose activity to show. |
| `TABLE_NAME` | required | DynamoDB table. |
| `GITHUB_APP_SECRET_ARN` | none | Secrets Manager JSON `{appId, installationId, privateKey, webhookSecret}`. |
| `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` | none | Local alternative to the secret. |
| `ALLOWED_ORIGINS` | site origins and localhost:4200 | Comma separated. |
| `ACTIVITY_TIMEZONE` | `America/Chicago` | For the weekday/hour heatmap. |
| `LIVE_EVENT_TTL_DAYS` | `30` | DynamoDB TTL for live events. |
| `REFRESH_DEBOUNCE_SECONDS` | `60` | A burst of pushes costs one GraphQL call. |
| `LOG_LEVEL` | `info` | Winston. |

## Setup, in order

1. **Prefix and account (done 2026-10-15).** `infrastructure/cdk/cdk.json` pins `resourcePrefix: gh-app`, `expectedAccount: 318205107378` and `profile: dsylvesteriii`. Synth fails if the resolved account differs. Changing the prefix replaces every `gh-app-*` resource.
2. **Deploy:** start Docker Desktop (the Lambda is a container image), then run `cd infrastructure/cdk && npx cdk deploy`. Note the `ActivityApiUrl`, `GitHubWebhookUrl` and `GitHubAppSecretArn` outputs.
3. **Register and install the App (done 2026-10-15: `dsylvester-activity`, App ID 5338237, installation 171901652):**
   ```sh
   cd src/api/activity
   bun scripts/register-github-app.mts --webhook-url <GitHubWebhookUrl>
   ```
   Click "Create" in the browser, then install the App on your account with **All repositories**. The script writes `.github-app.local.json`, which is gitignored.
4. **Store the credentials:**
   ```sh
   aws secretsmanager put-secret-value --secret-id gh-app-github-app-prod --secret-string file://.github-app.local.json --profile dsylvesteriii
   ```
   Then delete `.github-app.local.json`.
5. **Seed the first snapshot.** Wait for the hourly schedule, or seed it now:
   ```sh
   aws lambda invoke --function-name gh-app-activity-api-prod --payload '{"source":"aws.events"}' --cli-binary-format raw-in-base64-out out.json --profile dsylvesteriii
   ```
6. **Point the site at the API (done).** `ACTIVITY_API_PROD_URL` in `src/ui/src/app/activity/activity.config.ts` is `https://etgzi1pkz8.execute-api.us-east-1.amazonaws.com`. Publish the site to both buckets and invalidate CloudFront with:
   ```sh
   sh src/ui/scripts/deploy-ui.sh
   ```
   The script refuses to run if the profile resolves to an account other than 318205107378.
7. **Check it:** push a commit and watch `/activity` on the site. The App's "Advanced" settings page lists every webhook delivery and its response code.

## Local development

```sh
# API with real router and services over an in-memory store, seeded from the UI sample
cd src/api/activity && bun dev.mts                       # http://localhost:3100

# Refresh the bundled sample from GitHub with your gh token (local only, never deployed)
GITHUB_TOKEN=$(gh auth token) bun scripts/collect-local.mts

# Send correctly signed fake pushes (public, then private)
bun scripts/send-test-push.mts
bun scripts/send-test-push.mts http://localhost:3100 private

# UI
cd src/ui && bun run start                                # http://localhost:4200/activity
```

On localhost the UI calls `http://localhost:3100`. If the API is unreachable, it renders the bundled snapshot at `public/data/activity-sample.json` and hides the live feed.

## Checks

```sh
cd src/api/activity && bunx tsc --noEmit && bunx eslint . && bun test
cd src/ui && bun run build
```

The API pins TypeScript 6.0.3, not 7.0.2. typescript-eslint 8.71 supports TypeScript below 6.1 only, and lint must pass.

## Visual design

Colors use the dark-mode slots of the dataviz reference palette, validated against the site's card surface `#231638`. The lightness, chroma, colorblind-separation and contrast checks all pass. Every chart has a table twin behind the Charts/Tables toggle, and tooltips set text with `textContent`.

| Chart | Encodes |
|---|---|
| The year as a clock | One radial spoke per day. Length (sqrt) and shade show contributions, private included. |
| Where the commits went | Streamgraph of weekly public commits. The top five repos have their own stream and the rest fold into "Other". |
| When I ship | 7 × 24 heatmap of public commits by local weekday and hour. |
| Languages | Share of commits by language, as one-color horizontal bars. |
| Code written and refactored | Diverging weekly bars: lines added up, lines deleted down, on one axis. |
