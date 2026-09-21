# JobLint — AI Job Hunter & Kanban Tracker

<div align="center">

**Smart Chrome Extension (Manifest V3) for automated job clipping, AI-powered fit evaluation, skill gap analysis, and Kanban tracking.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.3-38bdf8.svg)](https://tailwindcss.com/)
[![WXT](https://img.shields.io/badge/WXT-0.21-purple.svg)](https://wxt.dev/)
[![Manifest V3](https://img.shields.io/badge/Chrome-MV3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#-features) •
[Supported Platforms](#-supported-job-platforms) •
[Installation](#-installation--setup) •
[AI Provider Setup](#-ai-provider-configuration) •
[Architecture](#-project-architecture) •
[Privacy](#-privacy--security)

</div>

---

## 🚀 Overview

**JobLint** transforms job hunting into a streamlined, data-driven workflow. Instead of manually copying job details into spreadsheets, JobLint automatically extracts postings from **LinkedIn** and **Indeed**, analyzes how well they align with your candidate profile using local heuristics and LLMs, highlights skill gaps and red flags, and tracks applications across a 6-stage Kanban board.

All job data, evaluations, notes, and profile settings are stored **100% locally** in your browser using IndexedDB.

---

## ✨ Features

### ⚡ One-Click Job Clipper & Floating Action Badge
- **Auto-Detection**: Instantly identifies job details when browsing LinkedIn or Indeed without needing to highlight or copy text.
- **Floating Badge**: Injects an isolated Shadow DOM badge on job pages for instant 1-click clipping to your Kanban board.
- **Comprehensive Scraper**: Extracts title, company, location, salary ranges, full cleaned job description, job ID, and application links.
- **Duplicate Prevention**: Detects already-saved postings and marks them with an active `Saved ✓` indicator.

### 🧠 Dual-Tier Evaluation Engine
- **Tier 1: Instant Offline Heuristics**:
  - **Skill Tokenizer**: Matches skills against your candidate tech stack and pinpoints missing prerequisites.
  - **Role & Seniority Alignment**: Detects job archetype (*Frontend, Backend, Full Stack, DevOps, AI/Data, Mobile*) and experience level (*Junior, Mid, Senior, Lead/Staff*).
  - **Location Compatibility**: Dynamically scores Remote, Hybrid, or On-site requirements against your preferred location.
  - **Red Flag Hunter**: Warns of unpaid roles, commission-only jobs, and unreasonable requirements (e.g., 5+ years required for junior positions).
  - **Global Score & Verdict**: Generates an algorithmic score (1.0–5.0) and action verdict (🟢 *Apply*, 🟡 *Apply with caution*, 🔴 *Skip*).
- **Tier 2: AI / LLM Deep Analysis**:
  - Connects to **OpenRouter**, **OpenAI**, **Groq**, **MiniMax**, or **local models** (Ollama, vLLM).
  - Generates structured, candidate-specific fit rationales, precise skill gap breakdowns, and confidence assessments.
  - Automatic error handling with seamless fallback to heuristic scoring if network or API limits occur.

### 👤 Candidate Profile Matcher
- Tailors evaluations directly against your profile:
  - **Target Roles** (e.g., *Full Stack Engineer, Backend Developer*)
  - **Skills & Tech Stack** (e.g., *TypeScript, React, Node.js, PostgreSQL, AWS*)
  - **Location & Work Authorization** (e.g., *New York, NY / Citizen / Work Permit*)
  - **Target Salary & Bio**
- **Evaluation Guard**: Prompts and alerts the user to configure their profile before running evaluations, guaranteeing relevant match scores.

### 📊 Fullscreen Kanban Application Board
- **6 Pipeline Stages**: `To Apply` → `Applied` → `Assessment` → `Interviewing` → `Offer` → `Rejected`.
- **HTML5 Drag-and-Drop**: Smooth card re-ordering and status progression.
- **Search & Filters**: Real-time filtering by job title, company name, or keyword.
- **Details Drawer**: Slide-out modal with full description review, notes editor, stage switcher, and direct re-evaluation.

### 💾 Complete Data Portability & Backup
- **CSV Export**: Export all jobs and evaluation data formatted for spreadsheets (Excel, Google Sheets, Notion).
- **JSON Backup & Restore**: One-click full data export and import for transferring between browsers or computers.

---

## 🌐 Supported Job Platforms

| Platform | URL Match | Detection Capabilities |
| :--- | :--- | :--- |
| **LinkedIn** | `linkedin.com/jobs/*` | Full job views (`/jobs/view/<id>`), search result lists, split-pane layout, guest views, collections |
| **Indeed** | `indeed.com`, `indeed.co.uk`, `indeed.ca`, `indeed.es`, `indeed.fr`, `indeed.de`, etc. | Single job view (`/viewjob`), search result side-drawers, server-rendered and client-rendered cards |

---

## 🛠️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm` (version 9+)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/eslam0ebrahem/jobLint.git
cd jobLint/extension
npm install
```

### 2. Development Mode
Runs the extension in live-reload mode with an isolated browser instance:
```bash
npm run dev
```

### 3. Build for Production
To build the production-ready unpacked extension:
```bash
npm run build
```
The output directory will be created at:
```
jobLint/extension/.output/chrome-mv3
```

To build and package a distribution `.zip` file:
```bash
npm run zip
```
The zip file will be generated at:
```
jobLint/extension/.output/joblint-extension-1.0.0-chrome.zip
```

---

## 📦 How to Load in Google Chrome

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click the **Load unpacked** button.
4. Select the directory:
   ```
   <path-to-jobLint>/extension/.output/chrome-mv3
   ```
5. The **JobLint** extension icon will now appear in your browser toolbar!

---

## ⚙️ AI Provider Configuration

JobLint works with any OpenAI-compatible API endpoint:

1. Click the **JobLint** extension icon in your browser toolbar.
2. Click the **⚙️ (Settings)** icon in the header to open the AI configuration page (`options.html`).
3. Choose a provider preset or input custom settings:

| Provider | Base URL | Model Example |
| :--- | :--- | :--- |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `qwen/qwen3.8-27b:free`, `google/gemma-4-26b-a4b-it:free`, `openai/gpt-4o-mini` |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini`, `gpt-4o` |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` |
| **MiniMax** | `https://api.minimax.io/v1` | `MiniMax-Text-01` |
| **Ollama (Local)** | `http://localhost:11434/v1` | `llama3.2`, `mistral` |

4. Enter your **API Key** and click **Fetch Models** to test the connection and auto-populate available models.
5. Click **Save**.

> [!NOTE]
> AI evaluation is optional. If no API key is provided, JobLint automatically utilizes its built-in heuristic evaluation engine offline.

---

## 📁 Project Architecture

```
jobLint/extension/
├── entrypoints/
│   ├── background.ts          # Background service worker (messaging, auto-injection)
│   ├── content.ts             # Content script (LinkedIn & Indeed DOM detectors)
│   ├── popup/                 # Extension popup UI (Quick clip, evaluate active tab)
│   ├── dashboard/             # Fullscreen Kanban board & job details drawer
│   ├── profile/               # Candidate profile form (skills, roles, preferences)
│   └── options/               # AI settings & provider configuration
├── src/
│   ├── components/            # Reusable UI components (JobCard, EvaluationCard, etc.)
│   ├── hooks/                 # React hooks (useJobs)
│   ├── lib/
│   │   ├── db.ts              # IndexedDB persistence layer (idb)
│   │   ├── ai.ts              # AI configuration, model discovery, and sanitizers
│   │   ├── export.ts          # CSV and JSON export/import utilities
│   │   ├── floatingBadge.ts   # Shadow DOM isolated on-page clipping badge
│   │   ├── detectors/         # Platform scrapers (LinkedIn, Indeed, generic utils)
│   │   └── evaluation/        # Heuristic rules, skill extraction, red flags, LLM runner (adapted from career-ops)
│   ├── types/
│   │   └── job.ts             # Core TypeScript interfaces & types
│   └── styles.css             # Tailwind CSS v4 styling
├── wxt.config.ts              # WXT build configuration & manifest declaration
└── package.json
```

---

## 🧪 Development & Quality Commands

```bash
# Type check TypeScript without emitting files
npm run compile

# Run ESLint across all entrypoints and source files
npm run lint

# Automatically fix linting issues
npm run lint:fix

# Build for Firefox
npm run build:firefox
npm run zip:firefox
```

---

## 🔒 Privacy & Security

- **Zero Remote Telemetry**: JobLint collects no analytics, tracking data, or usage metrics.
- **Local Storage**: All job postings, candidate information, notes, and application statuses are stored strictly on your device via browser IndexedDB.
- **Direct AI Calls**: When AI evaluation is enabled, requests are sent directly from your browser to your configured AI provider using your own API key. No intermediate proxy or relay server is used.

---

## 🙏 Attributions & Acknowledgements

The core job evaluation algorithms and heuristic scoring rules located in [`extension/src/lib/evaluation/`](file:///Users/IslamIbrahim/Work/jobLintDev/extension/src/lib/evaluation) were adapted and inspired by the open-source project [**CareerOps**](https://github.com/career-ops-hq/career-ops) and refactored by AI to fit JobLint's standalone Chrome extension architecture, user profile schema, and offline evaluation workflow.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
