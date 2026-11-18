# OpenRouter Free Quota

Adds an OpenRouter usage card to OpenChamber Usage. It reads OpenRouter's free-model
daily request quota through `GET https://openrouter.ai/api/v1/key`, using the
existing OpenCode `openrouter` credential forwarded by OpenChamber. No additional
API key or integration setting is needed.

The card reports used/limit/remaining requests and resets at the next UTC day.
If OpenRouter omits any quota value or the request fails, the card shows an
actionable error rather than an invented reading. Credentials are never logged.

## Build and test

```sh
bun install
bunx openchamber-guest-bundle --node service/main.ts service/main.js
bunx openchamber-guest-check
bun test tests/quota.test.ts
```
