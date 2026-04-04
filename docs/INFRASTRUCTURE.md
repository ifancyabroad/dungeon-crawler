# Infrastructure & CI/CD

This document describes the hosting setup, AWS resources, and CI/CD pipelines for dungeon-crawler.

---

## Architecture Overview

```
Browser
  └─► CloudFront (d21lqfvz2nru2t.cloudfront.net)
        ├─► /api/*          → Elastic Beanstalk (Node.js API)
        ├─► /socket.io/*    → Elastic Beanstalk (Socket.IO)
        └─► /*              → S3 (React SPA)
```

CloudFront is the single public entry point. Path-based routing splits traffic between the static frontend and the Node.js API. There is no separate subdomain for the API — both are served from the same CloudFront distribution.

---

## AWS Resources

| Resource                | Name / ID                                      | Notes                                                         |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| CloudFront distribution | `d21lqfvz2nru2t.cloudfront.net`                | Single entry point for all traffic                            |
| S3 bucket (frontend)    | `dungeon-crawler-fe`                           | Hosts built Vite SPA; not public — served via CloudFront only |
| Elastic Beanstalk app   | `dungeon-crawler`                              |                                                               |
| Elastic Beanstalk env   | `dungeon-crawler-env`                          | Single-instance, Node.js 20 on AL2023, `t3.small`             |
| Elastic IP              | `eipalloc-0c6b1a71c862f2493` — `13.135.69.114` | Stable outbound IP for MongoDB Atlas whitelisting             |
| CodePipeline (frontend) | `dungeon-crawler-fe-pipeline`                  | Triggers on push to `main`                                    |
| CodePipeline (API)      | `dungeon-crawler-api-pipeline`                 | Triggers on push to `main`                                    |
| CodeStar connection     | `aca9cca0-a8a9-4378-9aaf-628695aeb7df`         | GitHub OAuth connection (shared with other projects)          |
| Region                  | `eu-west-2`                                    |                                                               |

---

## Elastic Beanstalk Environment

- **Platform:** Node.js 20 on Amazon Linux 2023
- **Instance type:** `t3.small`, single-instance (no load balancer)
- **Procfile:** `web: node dist/server.js`

### Environment variables

Set via EB console → Configuration → Environment properties:

| Variable            | Purpose                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`          | `production`                                                                |
| `PORT`              | `8080` (EB default)                                                         |
| `MONGO_URI`         | MongoDB Atlas connection string                                             |
| `GAME_TOKEN_PEPPER` | Secret for hashing game session tokens                                      |
| `WEB_ORIGIN`        | CloudFront domain — used for CORS (`https://d21lqfvz2nru2t.cloudfront.net`) |

### Elastic IP

The EB instance uses an Elastic IP (`13.135.69.114`) as its stable outbound address so MongoDB Atlas can whitelist a fixed IP.

The EIP is **not** automatically associated on instance boot — it must be associated manually after any full environment rebuild:

```bash
# 1. Get the new instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:elasticbeanstalk:environment-name,Values=dungeon-crawler-env" \
  --region eu-west-2 \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text)

# 2. Associate the EIP
aws ec2 associate-address \
  --instance-id $INSTANCE_ID \
  --allocation-id eipalloc-0c6b1a71c862f2493 \
  --allow-reassociation \
  --region eu-west-2
```

> Normal CodePipeline deploys do **not** replace the instance, so the EIP stays associated between routine deploys.

---

## MongoDB Atlas

- **Cluster:** `cluster0.vxw6msq.mongodb.net`
- **Database:** `dungeon_crawler`
- **IP allowlist:** `13.135.69.114/32` (EB Elastic IP)

If the EIP is not yet associated after an environment rebuild, the instance will have a temporary ephemeral IP. Add it to the Atlas allowlist temporarily until the EIP is re-associated.

---

## CI/CD Pipelines

Both pipelines are triggered automatically by a push to the `main` branch on `ifancyabroad/dungeon-crawler` via the CodeStar GitHub connection.

### Frontend pipeline (`dungeon-crawler-fe-pipeline`)

**Buildspec:** `apps/web/buildspec.yml`

**Stages:** Source → Build → (no deploy stage — build uploads directly to S3)

**What it does:**

1. Installs dependencies with pnpm
2. Builds `@app/shared` → `@app/content` → `web` (Vite)
3. Syncs `apps/web/dist/` to the S3 bucket
4. Creates a CloudFront invalidation to clear the CDN cache

**CodeBuild env vars:**

- `S3_BUCKET` — defined in buildspec (`dungeon-crawler-fe`)
- `CF_DISTRIBUTION_ID` — injected as a CodeBuild environment variable

---

### API pipeline (`dungeon-crawler-api-pipeline`)

**Buildspec:** `apps/api/buildspec.yml`

**Stages:** Source → Build → Deploy (ElasticBeanstalk provider)

**What it does:**

1. Installs dependencies with pnpm
2. Builds `@app/shared` → `@app/content` → `@app/api` (via **tsup**)
3. Assembles the EB artifact: `dist/` + `Procfile` + `.ebextensions/`
4. CodePipeline deploys the artifact to `dungeon-crawler-env`

**Why tsup instead of tsc:** tsup (esbuild-based) bundles the API and all its dependencies — including workspace packages `@app/shared` and `@app/content` — into a single `dist/server.js`. This avoids the pnpm `workspace:*` protocol issue (workspace references can't be resolved outside the monorepo). The EB artifact contains no `node_modules` and requires no install step.

---

## CloudFront Cache Behaviours

| Path pattern   | Origin            | Cache    | Notes                                                 |
| -------------- | ----------------- | -------- | ----------------------------------------------------- |
| `/api/*`       | Elastic Beanstalk | Disabled | All headers + cookies forwarded                       |
| `/socket.io/*` | Elastic Beanstalk | Disabled | AllViewer origin request policy for WebSocket upgrade |
| `/*` (default) | S3                | Enabled  | SPA assets; invalidated on each frontend deploy       |

---

## Deployment Notes

### Both pipelines trigger on every push to `main`

There is no path filtering — a push that only changes frontend code will still trigger the API pipeline (and vice versa). This is acceptable for a dev/test environment. The extra build does no harm beyond a small delay.

### Re-deploying manually

To force a redeploy without a code change, you can trigger a pipeline execution from the AWS console or CLI:

```bash
# Frontend
aws codepipeline start-pipeline-execution --name dungeon-crawler-fe-pipeline --region eu-west-2

# API
aws codepipeline start-pipeline-execution --name dungeon-crawler-api-pipeline --region eu-west-2
```
