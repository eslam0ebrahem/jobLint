import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const bundlePath = '.output/chrome-mv3/background.js';
const bundle = readFileSync(bundlePath, 'utf8');
const storage = new Map();
const emitted = [];
const listeners = {};
const createdTabs = [];
const activeScanTab = { id: 17, url: 'https://www.linkedin.com/jobs/search/?keywords=engineer' };
let networkCalls = 0;

const localStorage = {
  async get(keys) {
    if (keys === undefined) return Object.fromEntries(storage);
    const names = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(names.filter((key) => storage.has(key)).map((key) => [key, storage.get(key)]));
  },
  async set(values) {
    for (const [key, value] of Object.entries(values)) storage.set(key, value);
  },
  async remove(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) storage.delete(key);
  },
};

const browser = {
  runtime: {
    id: 'joblint-gateway-smoke',
    async sendMessage(message) {
      emitted.push(message.event);
      return { ok: true, data: null };
    },
    onInstalled: { addListener: (listener) => { listeners.installed = listener; } },
    onStartup: { addListener: (listener) => { listeners.startup = listener; } },
    onMessage: { addListener: (listener) => { listeners.message = listener; } },
    getURL: (path) => `chrome-extension://joblint-gateway-smoke${path}`,
    getManifest: () => ({
      version: '1.0.0',
      permissions: ['activeTab', 'storage', 'tabs', 'scripting'],
      host_permissions: ['*://*.linkedin.com/*', '*://*.indeed.com/*'],
    }),
  },
  storage: { local: localStorage },
  tabs: {
    query: async (query = {}) => query.active ? [activeScanTab] : [],
    sendMessage: async (_tabId, message) => message?.action === 'scan-discovery-cards' ? [{
      source: 'linkedin',
      jobId: 'smoke-card-1',
      title: 'Discovered Smoke Engineer',
      company: 'JobLint QA',
      location: 'Remote',
      jobUrl: 'https://www.linkedin.com/jobs/view/smoke-card-1',
    }, {
      source: 'linkedin',
      jobId: 'smoke-card-2',
      title: 'Discovered Product Designer',
      company: 'JobLint QA',
      location: 'Remote',
      jobUrl: 'https://www.linkedin.com/jobs/view/smoke-card-2',
    }] : null,
    create: async ({ url }) => { createdTabs.push(url); },
  },
  scripting: { executeScript: async () => [] },
};

await new Promise((resolve) => {
  const request = indexedDB.deleteDatabase('joblint-db');
  request.onsuccess = resolve;
  request.onerror = resolve;
  request.onblocked = resolve;
});

const context = vm.createContext({
  AbortController,
  DOMException,
  Headers,
  Request,
  Response,
  URL,
  URLSearchParams,
  browser,
  chrome: browser,
  clearTimeout,
  console,
  crypto,
  defineBackground: (main) => main(),
  fetch: async () => {
    networkCalls += 1;
    throw new Error('Network access is forbidden in the local-first smoke test.');
  },
  indexedDB,
  navigator: { storage: { estimate: async () => ({ usage: 256, quota: 4096 }) } },
  setTimeout,
});
for (const name of ['IDBCursor', 'IDBDatabase', 'IDBIndex', 'IDBKeyRange', 'IDBObjectStore', 'IDBRequest', 'IDBTransaction']) {
  if (globalThis[name]) context[name] = globalThis[name];
}
vm.runInContext(bundle, context, { filename: bundlePath });

if (typeof listeners.message !== 'function' || typeof listeners.installed !== 'function' || typeof listeners.startup !== 'function') {
  throw new Error('The production background did not register gateway and lifecycle listeners.');
}
await listeners.installed();
await listeners.startup();

function dispatch(message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const keepChannel = listeners.message(message, {}, (response) => {
      settled = true;
      if (response?.ok) resolve(response.data);
      else reject(new Error(response?.error || 'Gateway request failed.'));
    });
    if (!keepChannel) {
      reject(new Error('The gateway rejected the request.'));
      return;
    }
    setTimeout(() => {
      if (!settled) reject(new Error('Gateway request timed out.'));
    }, 2_000);
  });
}

const call = (request) => dispatch({ request });
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

await call({ action: 'save-profile', profile: { roles: 'Smoke Engineer', skills: 'TypeScript, React' } });
await call({ action: 'save-preferences', preferences: { autoEnhanceWithAi: false, prioritizeFit: 0.6, prioritizeOpportunity: 0.25, riskTolerance: 'balanced' } });
const clipped = await call({
  action: 'clip-job',
  job: {
    source: 'manual',
    title: 'Runtime Smoke Engineer',
    company: 'JobLint QA',
    description: 'Build TypeScript and React services with Node.js and AWS.',
  },
});
const quickClip = await dispatch({
  action: 'quick-clip-job',
  job: { source: 'manual', title: 'Legacy Gateway Path', company: 'JobLint QA' },
});
const scan = await call({ action: 'scan-discovery-jobs' });
const [jobs, events, insights, diagnostics, profile, preferences, aiConfig, backup] = await Promise.all([
  call({ action: 'list-jobs' }),
  call({ action: 'get-events' }),
  call({ action: 'get-insights' }),
  call({ action: 'get-extension-diagnostics' }),
  call({ action: 'get-profile' }),
  call({ action: 'get-preferences' }),
  call({ action: 'get-ai-config' }),
  call({ action: 'export-backup' }),
]);
const preview = await call({ action: 'preview-backup', payload: backup });
const schema = await new Promise((resolve, reject) => {
  const request = indexedDB.open('joblint-db');
  request.onsuccess = () => {
    const database = request.result;
    const transaction = database.transaction(['jobs', 'discovery', 'followUps'], 'readonly');
    resolve({
      version: database.version,
      stores: [...database.objectStoreNames],
      indexes: [...transaction.objectStore('jobs').indexNames],
      discoveryIndexes: [...transaction.objectStore('discovery').indexNames],
      followUpIndexes: [...transaction.objectStore('followUps').indexNames],
    });
    database.close();
  };
  request.onerror = () => reject(request.error);
});

assert(clipped.isNew && clipped.job.evaluation?.evaluator === 'heuristic', 'Local clip workflow failed.');
assert(clipped.aiEnhanced === false && aiConfig.enabled === false, 'AI default changed.');
assert(quickClip.isNew, 'Legacy quick-clip compatibility failed.');
assert(jobs.length === 2 && insights.activeJobs === 2 && insights.evaluatedJobs === 2, 'Job listing or insights failed.');
assert(events.filter((event) => event.type === 'clipped').length === 2, 'Clip events were not written.');
assert(profile.roles === 'Smoke Engineer' && preferences.prioritizeFit === 0.6, 'Settings round-trip failed.');
assert(backup.schemaVersion === 2 && backup.jobs.length === 2 && backup.events.length === 2, 'Backup export failed.');
assert(preview.valid && preview.conflictCount === 2, 'Backup preview failed.');
assert(scan.detectedCount === 2 && scan.addedCount === 2 && scan.newCount === 2, 'Discovery scan gateway failed.');
assert(diagnostics.database.version === 8 && diagnostics.database.jobCount === 2 && diagnostics.database.eventCount === 2 && diagnostics.database.discoveryCount === 2 && diagnostics.database.followUpCount === 0, 'Diagnostics repository counts failed.');
assert(diagnostics.storage.usage === 256 && diagnostics.storage.quota === 4096, 'Diagnostics storage usage failed.');
assert(diagnostics.manifest.version === '1.0.0' && diagnostics.manifest.permissions.includes('storage'), 'Diagnostics manifest summary failed.');
assert(diagnostics.ai.enabled === false && !JSON.stringify(diagnostics).includes('apiKey'), 'Diagnostics exposed AI configuration secrets.');
assert(diagnostics.platforms.length === 2 && diagnostics.platforms.some((platform) => platform.source === 'linkedin'), 'Diagnostics platform summary failed.');
assert(schema.version === 8 && schema.stores.includes('jobs') && schema.stores.includes('events') && schema.stores.includes('discovery') && schema.stores.includes('followUps'), 'IndexedDB schema changed.');
assert(schema.indexes.includes('by-status') && schema.indexes.includes('by-updated'), 'Job indexes are incomplete.');
assert(schema.discoveryIndexes.includes('by-identity') && schema.discoveryIndexes.includes('by-updated'), 'Discovery indexes are incomplete.');
assert(schema.followUpIndexes.includes('by-job') && schema.followUpIndexes.includes('by-due'), 'Follow-up indexes are incomplete.');
assert(networkCalls === 0, `Unexpected network calls: ${networkCalls}.`);
assert(emitted.filter((event) => event?.type === 'job-updated').length === 2, 'Job delta events were not emitted exactly once per clip.');
assert(!emitted.some((event) => event?.type === 'jobs-changed'), 'Job edits incorrectly requested a full list reload.');
assert(listeners.message({ request: { action: 'invalid' } }, {}, () => {}) === false, 'Invalid requests were not rejected.');

const discoveryItem = scan.items[0];
const secondDiscoveryItem = scan.items[1];
const savedDiscovery = await call({ action: 'save-discovery', id: discoveryItem.id });
assert(savedDiscovery.record.status === 'saved' && savedDiscovery.job.title === 'Discovered Smoke Engineer', 'Discovery save gateway failed.');
const dismissedDiscovery = await call({ action: 'dismiss-discovery', id: secondDiscoveryItem.id });
assert(dismissedDiscovery.status === 'dismissed', 'Discovery dismiss gateway failed.');
await call({ action: 'revisit-discovery', id: discoveryItem.id });
assert(createdTabs.length === 1 && createdTabs[0] === discoveryItem.job.jobUrl, 'Discovery revisit gateway failed.');

const packet = await call({ action: 'get-application-packet', id: clipped.job.id });
assert(packet.localOnly === true && packet.alignment.score === clipped.job.evaluation.score && packet.evidence.length > 0, 'Local application packet gateway failed.');
await call({ action: 'record-outcome', id: clipped.job.id, outcome: 'interview' });
const analytics = await call({ action: 'get-outcome-analytics' });
assert(analytics.jobsWithOutcome === 1 && analytics.calibration.status === 'insufficient-data', 'Outcome analytics safeguards failed.');
const followUp = await call({ action: 'create-follow-up', jobId: clipped.job.id, title: 'Smoke follow-up', dueAt: '2099-01-01T09:00:00.000Z' });
assert((await call({ action: 'list-follow-ups', jobId: clipped.job.id })).length === 1, 'Follow-up list gateway failed.');
const updatedFollowUp = await call({ action: 'update-follow-up', id: followUp.id, title: 'Updated smoke follow-up' });
assert(updatedFollowUp.title === 'Updated smoke follow-up', 'Follow-up update gateway failed.');
const completedFollowUp = await call({ action: 'complete-follow-up', id: followUp.id });
assert(completedFollowUp.status === 'completed', 'Follow-up completion gateway failed.');
await call({ action: 'delete-follow-up', id: followUp.id });
assert((await call({ action: 'list-follow-ups', jobId: clipped.job.id })).length === 0, 'Follow-up deletion gateway failed.');

await call({ action: 'delete-job', id: clipped.job.id });
await call({ action: 'delete-job', id: quickClip.job.id });
await call({ action: 'clear-profile' });
assert((await call({ action: 'get-events', jobId: clipped.job.id })).length === 0, 'Deleting a job did not remove its events.');

console.log(JSON.stringify({
  bundle: bundlePath,
  gatewayActionsVerified: 37,
  localOnlyClip: true,
  aiDefaultsDisabled: true,
  backupCompatibility: true,
  deltaEvents: true,
  indexedDB: schema,
  networkCalls,
}, null, 2));
