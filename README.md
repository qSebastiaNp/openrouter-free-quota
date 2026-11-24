# OpenRouter Free Quota

An OpenChamber extension that displays your remaining daily OpenRouter free-model
request quota on the Usage page.

## Requirements

- OpenChamber 2.7.2 or later.
- An OpenRouter API key configured in OpenCode.

## Installation

In OpenChamber, open **Settings → Extensions** and add this repository's GitHub
URL, or add a local copy of the repository. Approve the requested quota service
and OpenRouter credential access. The extension uses the existing OpenCode
credential; no second API key is needed.

Open **Usage** to see the **OpenRouter Free Quota** card. It follows your Usage
display preference for used or remaining percentages. The daily quota resets at
midnight UTC. OpenRouter may exempt certain accounts or BYOK requests from
enforcement, so the displayed allowance is not always an enforced ceiling.

## Development

Install [Bun](https://bun.sh/) and run:

```sh
bun install
bunx openchamber-guest-bundle --node service/main.ts service/main.js
bunx openchamber-guest-check
bun test tests/quota.test.ts
bunx tsc --noEmit
```

Commit the bundled `service/main.js` alongside source changes: OpenChamber
loads the built service directly and does not build extensions during install.

## License

MIT. See [LICENSE](LICENSE) and [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES)
for the bundled OpenChamber SDK license.
