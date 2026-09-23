# JobLint — 5-Minute Pitch Script

**Total: ~713 words · ≈4:51 at a natural pace (~145 wpm) · 14 slides**

Delivery cues are in *italics*. The same script lives inside the deck — press **S** on any slide to see it with its time budget.

---

## Part 1 — Why? (slides 1–4, ~1:16)

### Slide 1 · Title (0:16)
*Stand center, breathe, smile.*

Hi everyone — I'm Eslam, and this is JobLint: an AI job hunter and Kanban tracker that lives inside your browser. In the next five minutes: the problem, a quick demo, how it's built, and what I learned.

### Slide 2 · Why? (0:04)
*Beat. Look at the audience.*

So — why did I build this at all?

### Slide 3 · The problem (0:25)
Job hunting today is basically a data-entry job. You scroll LinkedIn or Indeed, find something interesting, then manually copy-paste the title, company, and description into a spreadsheet. After fifty applications you have no overview — and the one question that matters, "should I apply to this job?", gets answered by gut feeling, not data.

### Slide 4 · Two hidden problems (0:31)
Under that disorganization hide two deeper problems. First, fit evaluation is expensive: descriptions are long, and really checking a posting against your skills takes time — so we apply blind. Second, red flags are easy to miss: commission-only pay, unpaid "experience", a junior role demanding five years. I wanted a tool that reads the posting for me, scores it against my profile, and keeps the pipeline tidy. That's why.

## Part 2 — What? / Demo (slides 5–9, ~2:14)

### Slide 5 · What? (0:04)
So here's what I built — JobLint, in one glance.

### Slide 6 · At a glance (0:29)
So here's JobLint: a Chrome extension on Manifest V3 that lives directly on LinkedIn and Indeed. It detects the job you're viewing, clips it with one click, evaluates fit against your profile — instantly, offline, with an optional AI layer — and drops it into a six-stage Kanban board. And a key design decision: everything stays 100% local in your browser. No accounts, no servers, no analytics.

### Slide 7 · Demo — floating badge (0:38)
Let me show you how it feels. You open any job on LinkedIn — within a second, a floating badge appears in the corner, injected as isolated Shadow DOM so the site's own CSS can never break it. One click on "Clip to Kanban" extracts the title, company, salary, and full cleaned description, checks for duplicates, and confirms. Already saved? The badge flips to "In Kanban" so you never clip twice. And layered detection survives LinkedIn's dynamic layouts, plus Indeed in six countries.

*On the slide: click the "Clip to Kanban" mock to show the live state change.*

### Slide 8 · Demo — evaluation (0:40)
Now the part I care most about: evaluation. Tier one is a deterministic engine that runs instantly in the browser — it matches the description against your skills, classifies role and seniority, scores location compatibility, and hunts red flags. All of it feeds a weighted score from one to five, with a verdict: Apply, Caution, or Skip. Tier two is optional: plug in any OpenAI-compatible API — even a local Ollama — and the LLM re-ranks the posting with reasoning, flagged with the AI badge. If the API fails, it silently falls back to heuristics. The score never disappears.

### Slide 9 · Demo — Kanban (0:23)
Everything lands here: a six-stage board — To Apply, Applied, Assessment, Interviewing, Offer, Rejected — with native drag-and-drop, real-time search, and a details drawer with the full description, notes, and re-evaluation. Your data comes back out as CSV for spreadsheets, or a full JSON backup and restore to move your search between machines.

## Part 3 — How? (slides 10–12, ~1:00)

### Slide 10 · How? (0:03)
Now — how is it actually built?

### Slide 11 · Architecture (0:32)
Architecturally, everything is wired through a background service worker. Content scripts handle DOM detection and the floating badge; the background worker owns persistence and message routing — it's the single gateway to the IndexedDB store. Popup, dashboard, profile, and settings are independent pages over the same store, so there's one source of truth. The scoring engine is pure and testable, and the LLM sits behind the same interface — AI is a plug-in, not a dependency.

### Slide 12 · Tech stack (0:25)
The stack: WXT as the bundler — hot reload, auto-manifest, Firefox builds for free. React 19 with strict TypeScript, Tailwind v4, and a tiny wrapper over IndexedDB. Deliberately no state-management library — React state plus one persistence hook covered everything. Zero backend, zero telemetry; AI requests go directly from the browser using your own key.

## Part 4 — Insights & Close (slides 13–14, ~0:41)

### Slide 13 · Lessons learned (0:24)
Three lessons stand out. The DOM is the hard part — job sites redesign constantly, so detection must be layered and defensive. Shadow DOM is essential whenever you inject UI into pages you don't control. And local-first is a feature in itself: no accounts, no servers, no privacy tradeoffs — users can feel the difference.

### Slide 14 · Close (0:17)
JobLint is open source, MIT-licensed, and installs in two minutes. What's next: Chrome Web Store release, automatic evaluation on clip, and shipped Firefox builds. If you've ever lost track of a job application, this one's for you. Thanks!

*Pause, smile, hold the last slide for questions.*

---

## Timing cheat sheet

| Part | Slides | Time |
|---|---|---|
| Why? | 1–4 | ~1:16 |
| What? / Demo | 5–9 | ~2:14 |
| How? | 10–12 | ~1:00 |
| Insights & Close | 13–14 | ~0:41 |
| **Total** | 14 | **~4:51** |

## Rehearsal tips

- The three divider slides (2, 5, 10) are breathers — one sentence each, no rushing.
- Slide 8 (evaluation) is the heart of the pitch; slow down there and let the score cards on screen breathe.
- If you're over time at slide 9, compress slides 11–12 into one line each: "one gateway, one store" and "WXT, React 19, TypeScript, zero backend."
- Hard cutoff option for a strict 5:00 room: drop slide 12's second half (~20 seconds saved).
