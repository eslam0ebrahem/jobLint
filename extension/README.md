# JobLint extension

This directory contains the WXT source for JobLint, a local-first job clipper, evidence-based evaluator, and six-stage application Kanban.

## Runtime model

- Content scripts run only on the host patterns in `src/lib/detectors/registry.ts`.
- Popup, dashboard, profile, and options are React surfaces that communicate through `src/lib/messages.ts` and `src/lib/gateway.ts`; job and event state is owned by focused hooks.
- `entrypoints/background.ts` is the composition root and gateway dispatcher. Injected application services own job, backup, settings, and AI workflows.
- Pure domain modules own identity, job/fact normalization, insights, discovery/packet/calibration policy, settings/AI policy, and v1/v2 backup parsing. They do not import browser APIs.
- Infrastructure adapters own IndexedDB schema v8, `browser.storage.local`, detector-platform access, alarms/notifications, and AI HTTP transport.
- Local deterministic evaluation is always available. AI is disabled by default; an explicit AI request creates an advisory assessment without replacing the local score or verdict. Automatic enhancement requires all three opt-ins: user preference, `AiConfig.enabled`, and `AiConfig.autoEnhance`.

The full user-facing guide, privacy boundary, supported domains, and backup behavior live in the repository [`README.md`](../README.md).

## Commands

```bash
npm install
npm run compile
npm run lint
npm test
npm run dev
npm run build
npm run build:firefox
npm run inspect:fixtures
npm run test:e2e
npm run test:e2e:firefox
npm run test:visual
```

`npm test` uses Vitest with jsdom and fake IndexedDB. The 65-test suite covers identity, job/fact normalization, discovery, local evaluation, packets, reminders, outcome analytics/calibration safeguards, AI fallback, IndexedDB migrations, backup parsing, settings, positive and blocked LinkedIn/Indeed browser fixtures, and the typed gateway contract. `npm run smoke:gateway` builds the production background bundle and runs a zero-network 37-action harness.

`npm run inspect:fixtures` executes the real detector modules against every sanitized browser fixture, writes a generated report to `.output/fixture-inspector/`, and starts the local Vite comparison UI. The inspector is a development tool and is not included in extension production builds. The capture and sanitization checklist lives in [`tests/fixtures/README.md`](tests/fixtures/README.md).

`npm run test:e2e` builds the Chrome artifact and runs a Playwright extension flow for discovery scanning, saving a discovered card, clipping a detail posting, and verifying the dashboard Kanban. `npm run test:e2e:firefox` checks the Firefox MV2 manifest contract and runs `web-ext lint`; Playwright does not load Firefox add-ons directly. `npm run test:visual` checks stable accessibility snapshots for detail, discovery, and blocked inspector states.

## Source map

```text
entrypoints/
  background.ts       composition root, gateway dispatch, events, lifecycle
  content.ts          detector lifecycle and badge bridge
  popup/              clip, local score, discovery scan, explicit AI review
  dashboard/          Kanban, discovery inbox, packets, insights, analytics, diagnostics
  profile/            candidate context and score weights
  options/            opt-in provider, reminder, and network settings
src/
  application/        job, discovery, packet, follow-up, reminder, analytics, backup, settings
  domain/             identity, facts, discovery, packet, calibration, backup policy
  infrastructure/
    database/         IndexedDB v8 repositories, migrations, and atomic event writes
    settings/         browser.storage.local profile/preferences adapter
    ai/               AI config storage and HTTP transport adapters
    detectors/        supported-tab health adapter
    reminders.ts      alarms and optional notification adapter
  components/         shared cards, lists, and evaluation report UI
  hooks/              useJobs collection state + useJobEvents timeline state
  lib/messages.ts     request/event protocol and runtime validation
  lib/gateway.ts      typed client transport and event subscription
  lib/detectors/      shared registry, JSON-LD, platform DOM, and card scanners
  lib/evaluation/     deterministic evaluator and pure scoring rules
tests/                 16 Vitest suites / 65 tests
  e2e/                  Playwright extension and artifact flows
  fixture-inspector/    local Vite UI for fixture source and extracted fields
wxt.config.ts          manifest permissions generated from the registry
```

## Detector limitations

LinkedIn and Indeed redesign their pages frequently. The detector uses several independent signals—URLs, IDs, canonical metadata, JSON-LD, and DOM selectors—and reports partial/unrecognized states instead of fabricating missing fields. The dashboard’s detector diagnostics and the manual-entry path are part of the supported workflow.
