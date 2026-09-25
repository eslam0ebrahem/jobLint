# JobLint — local-first job clipper and Kanban tracker

JobLint is a WXT Chrome/Firefox extension for clipping supported job postings, discovering search-result cards, producing deterministic fit reports, and tracking applications through a six-stage Kanban board. It is designed to remain useful without a network connection: the local evaluator is the default, and AI review is explicit and opt-in.

## What it does

- Detects LinkedIn and Indeed postings with layered DOM selectors plus defensive JSON-LD/canonical-link extraction.
- Adds a Shadow-DOM floating badge with duplicate detection and a manual-entry fallback.
- On explicit user request, scans visible LinkedIn/Indeed result cards into a deduplicated local discovery inbox; there is no background polling.
- Produces versioned, evidence-first reports with fit, opportunity, safety, risk, confidence, missing data, matched skills, gaps, and red flags.
- Normalizes employment type, work mode, skills, qualifications, benefits, compensation, posting dates, and explicit application deadlines.
- Tracks stage changes, notes, outcomes, follow-ups, application events, and opt-in local browser reminders.
- Builds an evidence-grounded application packet locally, with Markdown/JSON export controls and no generated claims beyond the saved profile and captured job.
- Shows outcome analytics and calibration guidance only after a 20-outcome minimum; calibration never silently changes the deterministic evaluator.
- Filters and sorts the dashboard, shows pipeline insights, and exposes privacy-safe extension diagnostics for active supported tabs.
- Exports spreadsheet-safe CSV and complete JSON backups, including normalized facts and follow-ups.
- Restores legacy v1 job arrays and v1/v2 backups with a conflict preview, skip/overwrite choices, event restoration, and per-record warnings.
- Supports Chrome MV3 and Firefox MV2 production builds through WXT.

## Local-first storage and network boundary

JobLint has no application backend, account, analytics, or telemetry.

| Data | Storage | Default behavior |
| --- | --- | --- |
| Jobs, normalized facts, evaluation reports, notes, outcomes, application events, discovery cards, and follow-ups | IndexedDB (`joblint-db`, schema v8) | Local only |
| Candidate profile, scoring preferences, and reminder opt-in | `browser.storage.local` | Local only |
| AI endpoint, key, model, and opt-in flags | `browser.storage.local` | Disabled until explicitly configured |

The optional AI adapter sends a bounded job snapshot directly from the browser to the endpoint selected in Settings. It does not replace the deterministic score: a successful response is stored as an advisory assessment, while malformed responses, timeouts, and network failures fall back to the local report. Automatic enhancement remains off by default and runs only when the user preference, `AiConfig.enabled`, and the persisted `AiConfig.autoEnhance` flag are all true. Application packets, discovery scans, outcome analytics, and calibration are local-only workflows; they do not call the network. Reminder notifications are off until explicitly enabled and, when enabled, contain only a bounded title/company/follow-up label.

## Privacy and permissions

JobLint requests page access only for the LinkedIn and Indeed domains in the shared registry, plus `storage`, `tabs`, `scripting`, and `alarms` for local operation. `notifications` is optional: the extension asks for it only when the user turns on reminders. Discovery is user-triggered from the popup; the extension does not poll search pages or read unrelated tabs. Local diagnostics never include API keys or job text. Optional AI requests are the only job-data network path and are disabled by default.

## Supported platforms

The shared platform registry drives content-script matches, host permissions, background tab injection, and diagnostics.

| Platform | Configured domains | Detection approach |
| --- | --- | --- |
| LinkedIn | `linkedin.com` and subdomains | URL/meta/canonical signals, layered DOM selectors, JSON-LD fallback |
| Indeed | `indeed.com`, `indeed.co.uk`, `indeed.ca`, `indeed.es`, `indeed.fr`, `indeed.de`, `indeed.it`, `indeed.nl`, `indeed.com.mx` | URL/data attributes, layered DOM selectors, JSON-LD fallback |

Job sites change frequently. If a supported page is not recognized, use **Add manually** in the popup or dashboard; the resulting record carries a manual-detection warning rather than pretending it was scraped with full confidence.

## Install and develop

Prerequisites: Node.js 18+ and npm.

```bash
cd extension
npm install
npm run dev
```

Production builds:

```bash
npm run compile       # tsc --noEmit
npm run lint
npm test              # 65 Vitest domain, application, persistence, detector, gateway, backup, packet, reminder, and analytics tests
npm run verify:fixtures # fail when detector fixture classifications drift
npm run inspect:fixtures # local visual report for LinkedIn/Indeed browser fixtures
npm run test:e2e      # Playwright discovery → clip → dashboard flow
npm run test:e2e:firefox # Firefox MV2 artifact contract + web-ext lint
npm run test:visual   # inspector accessibility snapshots
npm run smoke:gateway  # production bundle + offline 37-action gateway harness
npm run build         # .output/chrome-mv3
npm run build:firefox # .output/firefox-mv2
```

Load `.output/chrome-mv3` from `chrome://extensions` with Developer mode enabled. Firefox artifacts are written under `.output/firefox-mv2` and can be loaded through Firefox’s temporary add-on workflow. The production smoke harness is the supported automated runtime substitute when a branded browser blocks `--load-extension`; it exercises the real background bundle with fake IndexedDB and zero network calls.

`npm run inspect:fixtures` starts a local-only visual inspector for the sanitized LinkedIn and Indeed browser fixtures. It runs the real detector and discovery modules against every fixture, writes the generated report under `.output/fixture-inspector/`, and serves the comparison UI locally through Vite without sending fixture data to an external service. Fixture capture and sanitization guidance is in [`extension/tests/fixtures/README.md`](extension/tests/fixtures/README.md).

## Optional AI setup

Open **Settings** from the popup or dashboard and choose a provider preset or a custom OpenAI-compatible endpoint. HTTPS is required except for localhost endpoints such as Ollama. Enter a model ID or use model discovery, review the endpoint’s retention policy, then explicitly enable AI review.

The supported presets are OpenRouter, OpenAI, Groq, MiniMax, Ollama, and a custom endpoint. Model discovery and assessment requests have bounded timeouts. The API key is stored locally in the browser profile and is sent only to the configured endpoint.

## Architecture

```text
LinkedIn / Indeed pages
        │ DOM + JSON-LD + canonical detection
        ▼
content script ── floating badge / clip / explicit card scan ──┐
                                                               ▼
popup · dashboard · profile · options ── typed gateway ── background composition
                                                               │
                                                               ▼
                                              application use-case services
                              job · discovery · packet · follow-up/reminder · analytics
                              backup · settings · AI review
                                          │                 │
                                          ▼                 ▼
                                  pure domain policies   injected adapters
                         identity · facts · evaluator · packet · calibration
                         insights · backup parsing       IndexedDB v8 · storage.local
                                                      alarms · detectors · AI HTTP
```

Dependencies point inward: entrypoints call the typed gateway; the background entry point only composes services, dispatches actions, emits events, and wires lifecycle events; application services depend on injected repository, settings, evaluator, and AI ports; domain code is pure; infrastructure owns IndexedDB, `browser.storage.local`, detector-platform access, and AI HTTP. UI pages use `sendGatewayRequest` and focused hooks rather than persistence or evaluator APIs. The local evaluator remains deterministic and authoritative, while AI is a bounded, replaceable advisory adapter.

### Important modules

- `extension/entrypoints/background.ts` — dependency composition, typed gateway dispatch, events, and lifecycle wiring.
- `extension/entrypoints/content.ts` — detector lifecycle and isolated badge UI.
- `extension/entrypoints/dashboard/` — Kanban, discovery inbox, normalized facts, follow-ups, packets, insights, outcomes, calibration, diagnostics, and restore review.
- `extension/src/lib/messages.ts` and `gateway.ts` — typed protocol/runtime guard and client-only transport.
- `extension/src/application/` — injected job, discovery, packet, follow-up/reminder, analytics, backup, settings, AI-settings, and advisory-review use cases.
- `extension/src/domain/` — identity, job/fact normalization, insights, discovery/packet/calibration policies, settings/AI policy, and v1/v2 backup parsing.
- `extension/src/infrastructure/` — IndexedDB v8, browser storage, detector health, alarms/notifications, and AI HTTP adapters.
- `extension/src/lib/evaluation/` — deterministic evaluator, normalization, and role/skill/scoring rules only.
- `extension/src/lib/detectors/` — platform registry, structured data, detail detectors, and user-invoked search-card scanners.
- `extension/tests/` — 65 tests in 16 suites covering domain policies, application workflows, persistence migrations, positive and blocked detector browser fixtures, packets, reminders, analytics, and integration boundaries.

## Data portability

CSV is intended for spreadsheets and includes evaluation dimensions, risk, confidence, skills, gaps, outcomes, and notes. Fields that could be interpreted as spreadsheet formulas are prefixed safely.

JSON exports use schema v2 and include jobs (with normalized facts and outcome snapshots), events, follow-ups, profile, and preferences. API keys and AI configuration are intentionally excluded. v1 arrays and v1 `{ jobs: [...] }` files are accepted. Restore always previews record counts, conflicts, metadata, and validation warnings before writing. Calibration is calculated from outcome snapshots and remains advisory; it never changes the evaluator automatically.

## License and attribution

This project is MIT licensed. The evaluation work was informed by the open-source [CareerOps](https://github.com/career-ops-hq/career-ops) project; see [`extension/src/lib/evaluation/`](extension/src/lib/evaluation/) for the current implementation.
