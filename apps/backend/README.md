# LumenPulse Backend
NestJS API for LumenPulse.

## Setup

```bash
npm install
```

## Run

```bash
npm run start
npm run start:dev
npm run start:prod
```

## Test

```bash
nom run lint
npm run test
npm run test:e2e
```

## Demo bootstrap endpoint

The backend exposes an admin-only demo bootstrap endpoint that can populate a small set of sample crowdfund projects for reviewer/testnet validation.

Do enable it locally or in non-production test environment, set:

```bash
BOOTSTRAP_DEMO_DATA_ENABLED=true
```

Then call the endpoint with an admin JWT:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  http://localhost:3000/v1/crowdfund/admin/bootstrap-demo-data
```

The endpoint returns the created demo project IDs for verification.

> This endpoint is disabled by default and should not be enabled in production unless explicitly required.

## Testnet Friendbot bootstrap endpoint

The backend exposes an admin-only, testnet-only endpoint that funds fresh accounts via Stellar Friendbot:

```bash
FRIENDBOT_BOOTSTRAP_ENABLED=true
STELLAR_NETWORK=testnet
```

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"publicKey":"G..."}' \
  http://localhost:3000/v1/dev/testnet-bootstrap/fund
```

Safeguards: feature flag, `STELLAR_NETWORK=testnet` gate, admin JWT, dedicated rate limit, and a hardcoded Friendbot URL.

## Testnet bootstrap teardown endpoint

The backend also provides an admin-only teardown endpoint to undo a specific bootstrap run, identified by a run Id. This is useful for returning a testnet environment to a clean baseline.

Bootstrap runs are recorded with their identifier and the resources they created (e.g. accounts, ledger entries, demo data). The teardown endpoint will remove only those resources.

Safeguards:
- Admin JWT required.
- Only available when `STELLAR_NETWORK=testnet` or `NODE_ENV=development`.
- Refuses to run against any environment not explicitly marked as testnet or development.
- Dry-run mode is supported to list what would be removed without actually deleting anything.

Enable teardown explicitly with:

```bash
BOOTSTRAP_TEARDOWN_ENABLED=true
```

Example dry-run:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"runId":"<RUN_ID>", "dryRun":true}' \
  http://localhost:3000/v1/dev/testnet-bootstrap/teardown
```

Example actual teardown:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"runId":"<RUN_ID>"}' \
  http://localhost:3000/v1/dev/testnet-bootstrap/teardown
```

> This endpoint is disabled by default and should be used only in testnet or development environments.

## Security defaults

The backend includes:

- Global rate limiting with route-specific overrides for authentication and portfolio endpoints

- Strict DVO validation with `whitelist`, `forbidNonWhitelisted`, and transformation enabled

- Safe error formatting with a shared `{ code, message, details, requestId } contract

- Request ID propagation through the `X-Request-Id` response header

Key environment variables:

```bash
RATE_LIMIT_TRACK_BY_IP=true
RATE_LIMIT_TRACK_BY_API_KEY=false
RATE_LIMIT_API_KEY_HEADER=x-api-key
RATE_LIMIT_REDIS_URL=redis://localhost:6378
RATE_LIMIT_GLOBAL_LIMIT=120
RATE_LIMIT_GLOBAL_TTL_MS=60000
RATE_LIMIT_AUTH_LIMIT=8
RATE_LIMIT_AUTH_TTL_MS=60000
RATE_LIMIT_PORTFOLIO_READ_LIMIT=90
RATE_LIMIT_PORTFOLIO_READ_TTL_MS=60000
RATE_LIMIT_PORTFOLIO_WRITE_LIMIT=10
RATE_LIMIT_PORTFOLIO_WRITE_TTL_MS=60000
```

Example error response:

```json
{
  "code":"SYS_004",
  "message":"Validation failed",
  "details":[
    {
      "field":"email",
      "message":"email must be an email"
    }
  ],
  "requestId":"f2c3cb1c-8c86-4505-b4ce-fca50da2d46d"
}
```
