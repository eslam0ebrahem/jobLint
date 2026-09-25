# JobLint — 5-minute pitch script

**Format: 14 slides · approximately five minutes**

The script matches the deck’s speaker notes. Keep the demo short: the point is to show the product flow, then return to the architecture and tradeoffs.

## Part 1 — Why? (slides 1–4)

### Slide 1 · Title (0:16)
Hi everyone — I’m Eslam, and this is JobLint: a local-first job clipper and Kanban tracker that lives in your browser. In the next five minutes I’ll show the problem, the workflow, the architecture, and what I learned.

### Slide 2 · Why? (0:04)
So — why did I build this at all?

### Slide 3 · The problem (0:25)
Job hunting is still mostly data entry. You scroll LinkedIn or Indeed, find a promising role, and copy its title, company, and description into a spreadsheet. After fifty applications, you have scattered notes, forgotten stages, and no reliable answer to the question that matters: should I apply?

### Slide 4 · Two hidden problems (0:31)
Two problems sit underneath that mess. First, evaluating fit against your own skills is expensive when descriptions are long. Second, red flags are easy to miss at scroll speed: commission-only pay, unpaid experience, or a junior role asking for five years. I wanted a tool that turns a posting into evidence and keeps the pipeline organized.

## Part 2 — What and demo (slides 5–9)

### Slide 5 · What? (0:04)
So here’s what I built — JobLint in one glance.

### Slide 6 · At a glance (0:29)
JobLint is a WXT extension for LinkedIn and Indeed. It detects the current posting, clips it in one click, runs a deterministic local evaluation against the candidate profile, and stores it in a six-stage Kanban board. AI review is available only when someone explicitly configures it. Jobs and events live in IndexedDB; profile and scoring preferences live in local extension storage. There is no account, backend, or analytics system.

### Slide 7 · Floating badge (0:38)
Here’s the first interaction. On a supported job page, JobLint injects an isolated Shadow-DOM badge. One click extracts the fields it can find, cleans the description, checks identity-based duplicates, and runs the local score. If the posting is already saved, the badge says so. Detection uses URL and canonical signals, JSON-LD, and several DOM selector layers. If a site changes, the dashboard shows diagnostics and the manual-entry form remains available. Indeed is configured across nine domains, not a claim of worldwide coverage.

### Slide 8 · Evaluation (0:40)
The evaluator is evidence-first. It extracts skills with aliases, classifies role and seniority, scores location and work mode, looks for compensation and risk signals, and reports missing data instead of inventing it. The result has fit, opportunity, and safety dimensions, confidence, a verdict, and a traceable evidence list. The optional AI adapter is different: it sends a bounded snapshot to the endpoint I choose and attaches an advisory assessment. It never replaces the deterministic score, and malformed output or a timeout falls back safely.

### Slide 9 · Pipeline (0:23)
The board has six stages: To Apply, Applied, Assessment, Interviewing, Offer, and Rejected. Cards can move across stages, with search, risk and source filters, insights, outcomes, notes, and an activity timeline in the details drawer. CSV is formula-safe for spreadsheets. JSON exports include jobs, events, profile, and preferences, while restore previews conflicts before writing.

## Part 3 — How? (slides 10–12)

### Slide 10 · How? (0:03)
Now — how is it actually built?

### Slide 11 · Architecture (0:32)
The content script owns detection and the badge, but not persistence. A background service worker owns IndexedDB, events, settings, evaluation orchestration, and backup import/export. Popup, dashboard, profile, and options communicate through one typed runtime gateway, so the UI never reaches into the database directly. The local scoring functions are pure and testable. The LLM is a bounded adapter behind the same conceptual boundary, and it is optional rather than a dependency.

### Slide 12 · Tech stack (0:25)
The stack is WXT for extension bundling and browser targets, React 19, strict TypeScript, Tailwind v4, and a small promise wrapper over IndexedDB. Vitest, jsdom, and fake IndexedDB cover the domain and integration boundaries. There is no backend and no telemetry. If AI is enabled, the browser calls the configured provider directly with the user’s own key.

## Part 4 — Insights and close (slides 13–14)

### Slide 13 · Lessons learned (0:24)
Three lessons stand out. First, job-site DOMs are fragile; structured data, canonical URLs, layered selectors, diagnostics, and a manual fallback are all necessary. Second, style isolation matters whenever an extension touches a page it does not own. Third, local-first is a product decision: it makes the default workflow useful offline and makes the network boundary visible instead of hiding it.

### Slide 14 · Close (0:17)
JobLint is MIT-licensed and installs from a local production build. Local evaluation already runs on clip; AI remains opt-in. Next I’d package it for store review, expand detector fixtures, and learn from real users. If you’ve ever lost track of an application, this one’s for you. Thanks!

## Timing cheat sheet

| Part | Slides | Time |
|---|---:|---:|
| Why | 1–4 | ~1:16 |
| Demo | 5–9 | ~2:14 |
| How | 10–12 | ~1:00 |
| Insights and close | 13–14 | ~0:41 |
| **Total** | **14** | **~5:11** |

## Rehearsal notes

- Do not claim that every field is always extracted; demonstrate the warnings and manual fallback when relevant.
- Keep the AI explanation explicit: advisory only, direct request, no silent score replacement.
- If time is tight, compress slides 11–12 into: “one typed gateway, explicit local storage boundaries, and a pure evaluator with a bounded AI adapter.”
