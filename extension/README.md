# JobLint extension

This directory contains the WXT source for JobLint, a local-first job clipper, evidence-based evaluator, and six-stage application Kanban.

## Runtime model

- Content scripts run only on the host patterns in `src/lib/detectors/registry.ts`.
- The background service worker owns IndexedDB, event persistence, settings, evaluation orchestration, and backup import/export.
- Popup, dashboard, profile, and options are React surfaces that communicate through `src/lib/messages.ts` and `src/lib/gateway.ts`.
- Jobs, reports, notes, outcomes, and events live in IndexedDB schema v6. Profile, preferences, and AI configuration live in `browser.storage.local`.
- Local deterministic evaluation is always available. AI is disabled by default; an explicit AI request creates an advisory assessment without replacing the local score or verdict.

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

`npm test` uses Vitest with jsdom and fake IndexedDB. The suite covers identity and URL canonicalization, legacy normalization, local evaluation, AI malformed/timeout fallback behavior, IndexedDB events and ordering, backup parsing, detector fixtures, and the typed gateway contract.

## Source map

```text
entrypoints/
  background.ts       typed gateway and service-worker orchestration
  content.ts          detector lifecycle and badge bridge
  popup/              clip, local score, explicit AI review, manual fallback
  dashboard/          Kanban, insights, outcomes, diagnostics, restore review
  profile/            candidate context and score weights
  options/            opt-in provider and network settings
src/
  components/         shared cards, lists, and evaluation report UI
  hooks/useJobs.ts    gateway-backed live job state
  lib/backup.ts       pure v1/v2 backup parsing and validation
  lib/db.ts           versioned IndexedDB repository
  lib/detectors/      shared registry, JSON-LD, and platform DOM adapters
  lib/evaluation/     deterministic evaluator and optional AI adapter
  lib/messages.ts     request/event protocol and runtime validation
tests/                 Vitest suites
wxt.config.ts          manifest permissions generated from the registry
```

## Detector limitations

LinkedIn and Indeed redesign their pages frequently. The detector uses several independent signals—URLs, IDs, canonical metadata, JSON-LD, and DOM selectors—and reports partial/unrecognized states instead of fabricating missing fields. The dashboard’s detector diagnostics and the manual-entry path are part of the supported workflow.
