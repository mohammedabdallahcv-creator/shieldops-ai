# Change Log

All notable changes to the "shieldops-ai" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [2.0.1] - 2026-04-18

- Preserved the backend-provided report route so VS Code report links keep the extension origin context.
- Fixed the web-report handoff for extension-triggered CVE guidance.

## [2.0.0] - 2026-04-18

- Engine renamed from `heuristic` to `ShieldOps AI Engine`.
- Unified scoring into a primary `Security Score` plus a separate `Production Readiness` score on the web report.
- VS Code now emphasizes the report-aligned security score and top findings for Dockerfile scans.
- The web report now labels both scores clearly and adds a CVE handoff state when the scan has not been run yet.
- User-facing duplicate findings for `pip-no-cache` and `workdir` order checks are merged.
- `missing-stopsignal` now renders real translated copy instead of placeholder text.

## [0.0.9] - 2026-04-18

- Aligned Dockerfile result metrics with the report view by preferring `v2_scan` stats and findings.
- Removed conflicting score display that diverged from the web report.

## [0.0.8] - 2026-04-18

- Improved the VS Code Dockerfile result panel to show richer summary cards and issue context.
- Surfaced report-aligned scan metadata directly in the extension webview.

## [0.0.7] - 2026-04-18

- Fixed web app deep links to open the actual saved report view for extension-triggered analyses.
- Returned real `scan_id`-backed report routes from the extension API.

## [0.0.6] - 2026-04-18

- Added an actionable ShieldOps sidebar view in the VS Code activity bar.
- Added direct action buttons for analysis, scans, and integration hub access.

## [0.0.5] - 2026-04-18

- Added the ShieldOps AI activity bar container and sidebar registration.
- Prepared the extension for pinned sidebar access in VS Code.

## [0.0.4] - 2026-04-18

- Normalized hosted base URL handling away from localhost defaults.
- Improved extension routing behavior for hosted deployments.

## [0.0.3] - 2026-04-18

- Added Marketplace-ready SVG preview assets to the repository.
- Upgraded the README with a stronger product overview, workflow visuals, and results panel explanation.
- Improved the Marketplace presentation for the published extension page.

## [0.0.2] - 2026-04-18

- Added Marketplace metadata: repository, homepage, bugs, icon, and license.
- Polished the VS Code results panel to show structured findings instead of raw JSON.
- Improved packaging readiness for VS Code Marketplace publishing.

## [0.0.1] - 2026-04-18

- Initial API-first release of the ShieldOps AI extension.
