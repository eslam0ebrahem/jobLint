import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(scriptDirectory, '..');
const fixtureDirectory = resolve(extensionRoot, 'tests/fixtures/detectors');
const outputDirectory = resolve(extensionRoot, '.output/fixture-inspector');
const reportPath = resolve(outputDirectory, 'report.json');
const expectedPath = resolve(extensionRoot, 'tests/fixtures/expected.json');
const checkOnly = process.argv.includes('--check');
const originalGlobals = new Map();

function setGlobal(name, value) {
  if (!originalGlobals.has(name)) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function restoreGlobals() {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete globalThis[name];
    }
  }
  originalGlobals.clear();
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const server = await createServer({
  appType: 'custom',
  configFile: false,
  logLevel: 'error',
  resolve: {
    alias: {
      '@': extensionRoot,
    },
  },
  root: extensionRoot,
  server: {
    middlewareMode: true,
  },
});

const fixtures = [];
const failures = [];
const expected = JSON.parse(await readFile(expectedPath, 'utf8'));
const actual = new Map();

try {
  const { detectJob } = await server.ssrLoadModule('/src/lib/detectors/index.ts');
  const { scanDiscoveryCards } = await server.ssrLoadModule('/src/lib/detectors/discovery.ts');
  const fixtureFiles = (await readdir(fixtureDirectory))
    .filter((file) => file.endsWith('.html'))
    .sort();

  for (const file of fixtureFiles) {
    const html = await readFile(resolve(fixtureDirectory, file), 'utf8');
    const dom = new JSDOM(html, {
      contentType: 'text/html',
      pretendToBeVisual: true,
      url: 'https://fixture.invalid/',
    });
    const fixtureUrl = dom.window.document
      .querySelector('meta[name="fixture-url"]')
      ?.getAttribute('content');

    if (!fixtureUrl) {
      failures.push(`${file} is missing fixture-url metadata.`);
      dom.window.close();
      continue;
    }

    dom.reconfigure({ url: fixtureUrl });
    setGlobal('document', dom.window.document);
    setGlobal('location', dom.window.location);

    try {
      const detail = detectJob();
      const discovery = scanDiscoveryCards();
      fixtures.push({
        file: `tests/fixtures/detectors/${file}`,
        fixtureUrl,
        html,
        platform: new URL(fixtureUrl).hostname.includes('linkedin') ? 'LinkedIn' : 'Indeed',
        status: detail ? 'detail' : discovery.length ? 'discovery' : 'none',
        detail,
        discovery,
      });
    } catch (error) {
      failures.push(`${file}: ${errorMessage(error)}`);
      fixtures.push({
        file: `tests/fixtures/detectors/${file}`,
        fixtureUrl,
        html,
        platform: new URL(fixtureUrl).hostname.includes('linkedin') ? 'LinkedIn' : 'Indeed',
        status: 'error',
        error: errorMessage(error),
        detail: null,
        discovery: [],
      });
    } finally {
      restoreGlobals();
      dom.window.close();
    }
  }

  for (const fixture of fixtures) actual.set(fixture.file.split('/').at(-1), fixture.status);

  if (checkOnly) {
    for (const [file, status] of Object.entries(expected)) {
      if (!actual.has(file)) {
        failures.push(`${file}: expected ${status}, but the fixture is missing.`);
      } else if (actual.get(file) !== status) {
        failures.push(`${file}: expected ${status}, received ${actual.get(file)}.`);
      }
    }
    for (const file of actual.keys()) {
      if (!Object.prototype.hasOwnProperty.call(expected, file)) failures.push(`${file}: missing an expected classification.`);
    }
  } else {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
      reportPath,
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        fixtureCount: fixtures.length,
        fixtures,
      }, null, 2)}\n`,
      'utf8',
    );
  }
} finally {
  await server.close();
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = Object.entries(expected).map(([file, expectedStatus]) => {
    const actualStatus = actual.get(file) || 'missing';
    return `| ${file} | ${expectedStatus} | ${actualStatus} | ${expectedStatus === actualStatus ? 'matched' : 'changed'} |`;
  });
  for (const file of actual.keys()) {
    if (!Object.prototype.hasOwnProperty.call(expected, file)) rows.push(`| ${file} | — | ${actual.get(file)} | added |`);
  }
  const summary = [
    '### Fixture contract report',
    '',
    '| Fixture | Expected | Actual | Result |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
}

if (failures.length) {
  throw new Error(`Fixture inspector generation failed:\n${failures.join('\n')}`);
}

const detected = fixtures.filter((fixture) => fixture.status === 'detail').length;
const discovered = fixtures.filter((fixture) => fixture.status === 'discovery').length;
const blocked = fixtures.filter((fixture) => fixture.status === 'none').length;
console.log(`Fixture report: ${fixtures.length} fixtures · ${detected} detail · ${discovered} discovery · ${blocked} no result`);
console.log(checkOnly ? `Verified fixture contracts in ${expectedPath}` : `Wrote ${reportPath}`);
