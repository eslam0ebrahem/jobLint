const elements = {
  extraction: document.querySelector('#extraction'),
  filter: document.querySelector('#filter'),
  fixtureFrame: document.querySelector('#fixture-frame'),
  fixtureList: document.querySelector('#fixture-list'),
  fixtureName: document.querySelector('#fixture-name'),
  fixtureSource: document.querySelector('#fixture-source'),
  fixtureUrl: document.querySelector('#fixture-url'),
  generatedAt: document.querySelector('#generated-at'),
  platform: document.querySelector('#platform'),
  reload: document.querySelector('#reload'),
  status: document.querySelector('#status'),
  summary: document.querySelector('#summary'),
};

const state = {
  filter: '',
  fixtures: [],
  generatedAt: '',
  selected: undefined,
};

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function statusLabel(status) {
  if (status === 'detail') return 'Detail extracted';
  if (status === 'discovery') return 'Cards discovered';
  if (status === 'error') return 'Generator error';
  return 'No result';
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `Generated ${date.toLocaleTimeString()}`;
}

function renderSummary() {
  const counts = {
    detail: state.fixtures.filter((fixture) => fixture.status === 'detail').length,
    discovery: state.fixtures.filter((fixture) => fixture.status === 'discovery').length,
    none: state.fixtures.filter((fixture) => fixture.status === 'none').length,
    error: state.fixtures.filter((fixture) => fixture.status === 'error').length,
  };
  elements.summary.replaceChildren(
    summaryItem('All', state.fixtures.length, 'all'),
    summaryItem('Detail', counts.detail, 'detail'),
    summaryItem('Discovery', counts.discovery, 'discovery'),
    summaryItem('No result', counts.none, 'none'),
  );
  if (counts.error) elements.summary.append(summaryItem('Errors', counts.error, 'error'));
}

function summaryItem(label, value, status) {
  const item = createElement('div', `summary-item ${status}`);
  item.append(createElement('strong', '', String(value)), createElement('span', '', label));
  return item;
}

function filteredFixtures() {
  const query = state.filter.trim().toLowerCase();
  if (!query) return state.fixtures;
  return state.fixtures.filter((fixture) => [
    fixture.file,
    fixture.fixtureUrl,
    fixture.platform,
    fixture.status,
  ].some((value) => String(value).toLowerCase().includes(query)));
}

function renderFixtureList() {
  const fixtures = filteredFixtures();
  elements.fixtureList.replaceChildren(...fixtures.map((fixture) => {
    const button = createElement('button', 'fixture-item');
    button.type = 'button';
    if (fixture === state.selected) button.classList.add('selected');
    button.dataset.status = fixture.status;
    button.append(
      createElement('span', 'fixture-platform', fixture.platform),
      createElement('span', 'fixture-name', fixture.file.split('/').at(-1)),
      createElement('span', 'fixture-state', statusLabel(fixture.status)),
    );
    button.addEventListener('click', () => selectFixture(fixture));
    return button;
  }));

  if (!fixtures.length) {
    elements.fixtureList.append(createElement('p', 'empty-list', 'No fixtures match this filter.'));
  }
}

function selectFixture(fixture) {
  state.selected = fixture;
  elements.fixtureName.textContent = fixture.file.split('/').at(-1);
  elements.platform.textContent = `${fixture.platform} browser fixture`;
  elements.fixtureUrl.textContent = fixture.fixtureUrl;
  elements.fixtureUrl.href = fixture.fixtureUrl;
  elements.status.textContent = statusLabel(fixture.status);
  elements.status.dataset.status = fixture.status;
  elements.fixtureFrame.srcdoc = fixture.html;
  elements.fixtureSource.textContent = fixture.html;
  renderFixtureList();
  renderExtraction(fixture);
}

function appendField(container, label, value) {
  if (value === undefined || value === null || value === '') return;
  const field = createElement('div', 'field');
  field.append(createElement('span', 'field-label', label), createElement('span', 'field-value', String(value)));
  container.append(field);
}

function renderJob(job, headingText) {
  const section = createElement('section', 'job-result');
  const heading = createElement('div', 'job-heading');
  heading.append(
    createElement('p', 'eyebrow', job.source === 'linkedin' ? 'LinkedIn' : 'Indeed'),
    createElement('h4', '', job.title || 'Untitled job'),
  );
  if (job.company) heading.append(createElement('p', 'company', job.company));
  section.append(heading);

  const fields = createElement('div', 'field-grid');
  appendField(fields, 'Job ID', job.jobId);
  appendField(fields, 'Location', job.location);
  appendField(fields, 'Salary', job.salary);
  appendField(fields, 'Detection', job.detection?.strategy);
  appendField(fields, 'State', job.detection?.state);
  appendField(fields, 'Confidence', job.detection?.confidence);
  appendField(fields, 'Job URL', job.jobUrl);
  appendField(fields, 'Apply URL', job.applyUrl);
  section.append(fields);

  if (job.description) {
    const description = createElement('div', 'long-field');
    description.append(
      createElement('span', 'field-label', 'Description'),
      createElement('p', '', job.description),
    );
    section.append(description);
  }

  const resultTitle = createElement('div', 'result-title');
  resultTitle.append(createElement('h3', '', headingText));
  section.prepend(resultTitle);
  return section;
}

function renderExtraction(fixture) {
  const content = [];
  if (fixture.error) {
    const error = createElement('div', 'empty-state error');
    error.append(createElement('h3', '', 'Generator error'), createElement('p', '', fixture.error));
    content.push(error);
  } else {
    if (fixture.detail) content.push(renderJob(fixture.detail, 'Detail posting'));
    if (fixture.discovery?.length) {
      const section = createElement('section', 'discovery-results');
      section.append(createElement('h3', '', `Discovery cards (${fixture.discovery.length})`));
      fixture.discovery.forEach((job, index) => {
        section.append(renderJob(job, `Card ${index + 1}`));
      });
      content.push(section);
    }
    if (!fixture.detail && !fixture.discovery?.length) {
      const empty = createElement('div', 'empty-state');
      empty.append(
        createElement('div', 'empty-icon', '✓'),
        createElement('h3', '', 'No job emitted'),
        createElement('p', '', 'The detector correctly rejected this consent, authentication, expired, or incomplete state.'),
      );
      content.push(empty);
    }
  }
  elements.extraction.replaceChildren(...content);
}

function showLoadError(error) {
  elements.fixtureName.textContent = 'Fixture report unavailable';
  elements.platform.textContent = 'Local development';
  elements.status.textContent = 'Load error';
  elements.status.dataset.status = 'error';
  const message = createElement('div', 'empty-state error');
  message.append(
    createElement('h3', '', 'Generate the report first'),
    createElement('p', '', error.message),
    createElement('code', '', 'npm run inspect:fixtures'),
  );
  elements.extraction.replaceChildren(message);
  elements.fixtureList.replaceChildren();
  elements.summary.replaceChildren();
}

async function load() {
  try {
    const response = await fetch('./report.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Report request failed with ${response.status}.`);
    const report = await response.json();
    state.fixtures = report.fixtures || [];
    state.generatedAt = report.generatedAt || '';
    elements.generatedAt.textContent = formatTimestamp(state.generatedAt);
    renderSummary();
    const firstVisible = filteredFixtures()[0];
    if (firstVisible) selectFixture(firstVisible);
    else renderFixtureList();
  } catch (error) {
    showLoadError(error instanceof Error ? error : new Error(String(error)));
  }
}

elements.filter.addEventListener('input', () => {
  state.filter = elements.filter.value;
  renderFixtureList();
  const firstVisible = filteredFixtures()[0];
  if (firstVisible && !filteredFixtures().includes(state.selected)) selectFixture(firstVisible);
});
elements.reload.addEventListener('click', () => window.location.reload());

load();
