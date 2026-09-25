# JobLint extension

This directory contains the WXT source for JobLint, a local-first job clipper, evidence-based evaluator, and six-stage application Kanban.

## Runtime model

- Content scripts run only on the host patterns in `src/lib/detectors/registry.ts`.
- Popup, dashboard, profile, and options are React surfaces that communicate through `src/lib/messages.ts` and `src/lib/gateway.ts`; job and event state is owned by focused hooks.
- `entrypoints/background.ts` is the composition root and gateway dispatcher. Injected application services own job, backup, settings, and AI workflows.
- Pure domain modules own identity, job normalization, insights, settings/AI policy, and v1/v2 backup parsing. They do not import browser APIs.
- Infrastructure adapters own IndexedDB schema v6, `browser.storage.local`, detector-platform access, and AI HTTP transport.
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
```

`npm test` uses Vitest with jsdom and fake IndexedDB. The 33-test suite covers identity and URL canonicalization, pure job normalization and insights, local evaluation, AI malformed/timeout fallback behavior, IndexedDB migration/events/ordering, backup parsing and conflict/event remapping, settings mutations, application-service policy, detector fixtures, and the typed gateway contract.

## Source map

```text
entrypoints/
  background.ts       composition root, gateway dispatch, events, lifecycle
  content.ts          detector lifecycle and badge bridge
  popup/              clip, local score, explicit AI review, manual fallback
  dashboard/          Kanban, insights, outcomes, diagnostics, restore review
  profile/            candidate context and score weights
  options/            opt-in provider and network settings
src/
  application/        job, backup, settings, AI-settings, and review use cases
  domain/             identity, normalization, insights, policy, backup parsing
  infrastructure/
    database/         IndexedDB v6 repository and atomic event writes
    settings/         browser.storage.local profile/preferences adapter
    ai/               AI config storage and HTTP transport adapters
    detectors/        supported-tab health adapter
  components/         shared cards, lists, and evaluation report UI
  hooks/              useJobs collection state + useJobEvents timeline state
  lib/messages.ts     request/event protocol and runtime validation
  lib/gateway.ts      typed client transport and event subscription
  lib/detectors/      shared registry, JSON-LD, and platform DOM adapters
  lib/evaluation/     deterministic evaluator and pure scoring rules
  lib/{ai,backup,db,identity,settings}.ts
                       compatibility re-exports for previous internal paths
tests/                 9 Vitest suites / 33 tests
wxt.config.ts          manifest permissions generated from the registry
```

## Detector limitations

LinkedIn and Indeed redesign their pages frequently. The detector uses several independent signals—URLs, IDs, canonical metadata, JSON-LD, and DOM selectors—and reports partial/unrecognized states instead of fabricating missing fields. The dashboard’s detector diagnostics and the manual-entry path are part of the supported workflow.
