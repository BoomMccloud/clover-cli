# Clover CLI

## Current work

Standalone source for @diffuspace/cli, version 0.1.9. The command
`diffuspace clover` asks for an API key on first run, starts an authenticated
localhost adapter, and launches the Clover Codex profile. Endpoint and model ID
are fixed. The upstream base URL is `https://api.diffuspace.ai/v1`, without a
custom port. Context is 128,000 tokens. Claude Code is out of scope.

The source previously lived in diffusion-demo/packages/diffuspace-cli. Treat this
standalone repository as the source of truth for future CLI changes.

## Verification

Run `npm run check` and `npm test`. Tests use localhost HTTP with mocked upstream
responses and do not require a real API key. A live inference test is separate
and must use isolated state, bounded runtime, and fictional input.

## Constraints

- Preserve base Codex configuration, other profiles, and running sessions.
- Save keys outside the repository, never log or commit them.
- Keep the launch command `diffuspace clover` and Clover capitalization.
- Keep the JSON reminder upfront. Unsupported structured constraints must still
  fail explicitly, never be silently removed.
- Tips rotate between launches, never while a user is working.
- Keep apps/plugins disabled only for the Clover profile. Large inherited tool
  catalogs caused upstream failures. Standalone MCP tools retain normal approvals.
- Do not add approval bypasses, publish npm packages, or create GitHub releases
  without explicit user authorization.
