# ShieldOps AI for VS Code

<p align="center">
  <img src="images/icon.png" alt="ShieldOps AI" width="128" height="128" />
</p>

ShieldOps AI brings core container and infrastructure workflows into VS Code while staying aligned with the live ShieldOps backend. The current release is API-first for supported tasks, with safe web fallback where the product flow is still page-first.

- Dockerfile Analysis
- AutoFix
- SBOM
- Compose Scan
- Kubernetes Scan
- Cloud Cost
- Compose Generator

## Why Install ShieldOps AI?

- Run security-oriented workflows from the file you already have open.
- Send supported tasks directly to the ShieldOps backend without copying payloads manually.
- Review structured findings inside a dedicated VS Code results panel.
- Fall back to the web app only when the current product journey is still page-first.

## How V1 Works

This V1 extension is intentionally simple:

1. Open a supported file in VS Code.
2. Run one of the ShieldOps AI commands.
3. The extension calls the ShieldOps extension API directly.
4. Results open inside a VS Code panel.
5. If a task is still web-first, the extension falls back to opening the matching ShieldOps page.

## What The Results Panel Shows

- Findings table grouped by severity
- Line hints when available
- Summary metrics such as issue count, score, engine, and scan id
- A clean empty state when no issues are found

## Commands

- `ShieldOps AI: Open Integration Hub`
- `ShieldOps AI: Analyze Current File`
- `ShieldOps AI: AutoFix Current Dockerfile`
- `ShieldOps AI: Generate SBOM From Current File`
- `ShieldOps AI: Scan Current Compose File`
- `ShieldOps AI: Scan Current Kubernetes File`
- `ShieldOps AI: Estimate Cloud Cost From Current File`
- `ShieldOps AI: Generate Compose From Current File`

## Configuration

The extension exposes one setting:

- `shieldopsAI.baseUrl`
- `shieldopsAI.apiToken`

Default:

```json
"shieldopsAI.baseUrl": "http://127.0.0.1:5000",
"shieldopsAI.apiToken": ""
```

Change `baseUrl` if your ShieldOps app runs on another host or port. `apiToken` is optional for hosted deployments that protect the extension API with a shared token.

## Supported V1 File Types

- Dockerfile Analysis: `Dockerfile`, `*.dockerfile`
- AutoFix: `Dockerfile`, `*.dockerfile`
- SBOM: `Dockerfile`, `requirements.txt`, `package.json`, `pom.xml`, `composer.json`, `go.mod`, `Gemfile`
- Compose Scan: `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`
- Kubernetes Scan: `.yml`, `.yaml`
- Cloud Cost: `Dockerfile`, `*.dockerfile`
- Compose Generator: `Dockerfile`, `*.dockerfile`

## Marketplace Notes

- Current release: `v0.0.2`
- Publisher: `mohammedabdallahcv`
- Marketplace page: `mohammedabdallahcv.shieldops-ai`

## Roadmap

- Richer result panels per workflow instead of a shared V1 layout
- Direct hosted-auth onboarding from inside the extension
- More polished task-specific summaries for Compose, SBOM, and AutoFix

## Development

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.
