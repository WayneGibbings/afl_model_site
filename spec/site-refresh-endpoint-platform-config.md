# Site Refresh Endpoint Platform Configuration

## Problem

The Databricks task is correctly sending:

- `POST https://waynealytics-tips.gibbings.net/api/site-data/refresh`
- header: `x-site-refresh-token`

But the deployed endpoint is returning a Google Frontend `403 Forbidden` HTML page before the application handler runs.

That means the platform layer is rejecting the request first. The shared secret header is not being evaluated yet.

## Required Architecture

For this webhook design, there are two separate layers of access control:

1. Platform access
   The route must be publicly reachable so Databricks can send an ordinary HTTPS request.
2. Application access
   The handler itself validates `x-site-refresh-token` and returns `401` or `403` when the token is wrong.

If platform access is private, Databricks would need to mint and send a Google identity token. That is a different design and is not what the current Databricks code implements.

## Expected Behaviour

The endpoint should behave like this:

- Request reaches the handler without Google Frontend blocking it.
- Handler reads `x-site-refresh-token`.
- Handler compares it to the configured server-side secret.
- Handler returns:
  - `200` on success
  - `401` or `403` for invalid token
  - `405` for wrong method

## Firebase Hosting / Function Routing

If the public URL is `https://waynealytics-tips.gibbings.net/api/site-data/refresh`, Firebase Hosting must rewrite that path to the deployed backend.

Example `firebase.json` shape:

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "/api/site-data/refresh",
        "function": "siteDataRefresh"
      },
      {
        "source": "/api/site-data/latest",
        "function": "siteDataLatest"
      }
    ]
  }
}
```

If the backend is Cloud Run rather than a Firebase Function, the rewrite must point to the Cloud Run service instead.

The key point is that `/api/site-data/refresh` must be routed to a live backend in the deployed environment.

## Cloud Functions / Cloud Run Access

The backing service must allow unauthenticated invocation at the platform layer.

That does not mean the webhook is unsecured. It means:

- Google allows the HTTPS request through to the service.
- The service code enforces the shared-secret check.

If unauthenticated invocations are disabled, requests fail with a platform `403` before your handler can inspect `x-site-refresh-token`.

## Cloud Run Example

If this endpoint is backed by Cloud Run, allow public invocation:

```bash
gcloud run services add-iam-policy-binding site-data-refresh \
  --region=YOUR_REGION \
  --member="allUsers" \
  --role="roles/run.invoker"
```

Then keep the secret validation in application code.

## Firebase Functions v2 Example

For a Functions v2 HTTP endpoint, keep the function reachable and validate the secret in the handler:

```ts
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const siteRefreshToken = defineSecret("SITE_REFRESH_TOKEN");

export const siteDataRefresh = onRequest(
  { secrets: [siteRefreshToken] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    const provided = req.header("x-site-refresh-token");
    const expected = siteRefreshToken.value();

    if (!provided || provided !== expected) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const body = req.body ?? {};

    res.status(200).json({
      ok: true,
      trigger: body.trigger ?? "unknown",
      updated: false
    });
  }
);
```

## What Not To Do

Do not combine these two incompatible models:

- private platform access requiring Google-authenticated callers
- application code expecting only `x-site-refresh-token`

If the service is private, Databricks must present Google credentials. If Databricks is only sending the shared secret header, the service must be publicly invokable.

## Verification Checklist

1. Confirm `POST /api/site-data/refresh` is rewritten to the deployed backend.
2. Confirm the deployed backend exists in the expected project and region.
3. Confirm unauthenticated platform invocation is allowed.
4. Confirm the backend reads `x-site-refresh-token`.
5. Confirm the backend secret exactly matches Databricks secret `afl-site/site-refresh-token`.
6. Test with `curl`:

```bash
curl -i -X POST https://waynealytics-tips.gibbings.net/api/site-data/refresh \
  -H "Content-Type: application/json" \
  -H "x-site-refresh-token: REPLACE_ME" \
  --data '{"trigger":"manual-test"}'
```

Expected outcomes:

- `200` means platform routing and token validation are both working.
- JSON `403` means the request reached your handler, but the token is wrong.
- HTML `403` from Google Frontend means the platform is still blocking the request before the handler runs.

## Recommended Fix For Current Failure

Given the current response body:

- the route is being blocked by Google Frontend
- the immediate fix is on the site hosting / Cloud Run / Firebase deployment side
- do not change the Databricks request format further until the platform `403` is gone
