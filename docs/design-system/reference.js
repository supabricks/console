/* Standalone design examples. No console API or production component dependency. */
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const token = (name) => getComputedStyle(document.body).getPropertyValue(`--sb-${name}`).trim();
function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map((channel) => parseInt(channel, 16) / 255);
  return channels.map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
}
function contrast(foreground, background) {
  const values = [luminance(token(foreground)), luminance(token(background))].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
function renderFoundations() {
  const swatches = [['canvas', 'Canvas'], ['surface', 'Surface'], ['text', 'Primary text'], ['text-secondary', 'Secondary text'], ['primary', 'Primary action'], ['accent', 'Cyan accent'], ['selection', 'Selection'], ['border-control', 'Control border']];
  $('#swatches').innerHTML = swatches.map(([name, label]) => `<div class="ds-swatch"><div class="ds-swatch-color" style="background:var(--sb-${name})"></div><div class="ds-swatch-label"><strong>${label}</strong><code>${token(name).toUpperCase()}</code></div></div>`).join('');
  const pairs = [];
  for (const background of ['canvas', 'surface', 'surface-subtle', 'surface-hover']) {
    for (const foreground of ['text', 'text-secondary', 'text-tertiary', 'primary']) pairs.push([foreground, background, 4.5]);
    pairs.push(['border-control', background, 3], ['focus', background, 3]);
  }
  for (const state of ['success', 'warning', 'danger', 'info']) pairs.push([state, `${state}-soft`, 4.5]);
  pairs.push(['accent-text', 'accent-soft', 4.5], ['selection-text', 'selection', 4.5], ['primary', 'selection', 4.5], ['on-danger', 'danger', 4.5], ['on-danger', 'danger-hover', 4.5]);
  for (const background of ['primary', 'primary-hover', 'primary-active']) pairs.push(['on-primary', background, 4.5]);
  const results = pairs.map(([foreground, background, minimum]) => ({ foreground, background, minimum, ratio: contrast(foreground, background) }));
  // Exposed for inspection of this reference, not an accessibility certification.
  window.designContrastResults = results;
  const failures = results.filter((result) => result.ratio < result.minimum);
  $('#contrast-summary').textContent = `${results.length} token contrast pairs checked in ${document.body.dataset.sbTheme} mode. ${failures.length ? `${failures.length} need review.` : 'All meet their text (4.5:1) or control/focus (3:1) targets.'} These checks do not replace a full accessibility review.`;
}
$('#theme').addEventListener('change', (event) => {
  document.body.dataset.sbTheme = event.target.value;
  renderFoundations();
});
$('#density').addEventListener('change', (event) => { document.body.dataset.sbDensity = event.target.value; });
$('#spacing-samples').innerHTML = [4, 8, 12, 16, 20, 24, 32, 40, 48].map((size) => `<div class="ds-space-sample"><span style="width:${size}px;height:${size}px"></span>${size}</div>`).join('');
renderFoundations();

const datasets = [
  { id: 'customers', name: 'customers', rows: 3840, status: 'Ready', published: 'Today, 09:15', owner: 'Maya Chen' },
  { id: 'daily-revenue', name: 'daily_revenue', rows: 365, status: 'Ready', published: 'Today, 09:30', owner: 'You' },
  { id: 'inventory', name: 'inventory', rows: 620, status: 'Updating', published: 'Yesterday', owner: 'Maya Chen' },
  { id: 'orders', name: 'orders', rows: 12480, status: 'Ready', published: 'Today, 09:30', owner: 'You' },
  { id: 'products', name: 'products', rows: 248, status: 'Ready', published: 'Yesterday', owner: 'Sam Rivera' },
  { id: 'returns', name: 'returns', rows: 86, status: 'Needs review', published: 'Sep 20, 2026', owner: 'Sam Rivera' },
];
const selected = new Set();
let sort = { key: 'name', direction: 1 };
function visibleRows() {
  const filter = $('#filter').value.trim().toLowerCase();
  return datasets.filter((row) => row.name.includes(filter)).sort((a, b) => sort.direction * (sort.key === 'rows' ? a.rows - b.rows : a.name.localeCompare(b.name)));
}
function renderTable() {
  const rows = visibleRows();
  $('#dataset-rows').innerHTML = rows.map((row) => {
    const [status, symbol] = row.status === 'Ready' ? ['success', '✓'] : row.status === 'Updating' ? ['info', '◷'] : ['warning', '!'];
    return `<tr data-selected="${selected.has(row.id)}"><td class="ds-check-cell"><label class="ds-check-target"><input type="checkbox" data-select="${row.id}" aria-label="Select ${row.name}" ${selected.has(row.id) ? 'checked' : ''}></label></td><td><button class="ds-row-link" data-dataset="${row.id}">${row.name}</button></td><td><span class="ds-status ds-status-${status}">${symbol} ${row.status}</span></td><td class="ds-numeric">${row.rows.toLocaleString('en-US')}</td><td>${row.published}</td><td>${row.owner}</td><td><button class="ds-btn ds-btn-ghost ds-icon-btn" data-dataset="${row.id}" aria-label="View details for ${row.name}">↗</button></td></tr>`;
  }).join('');
  $('#table-count').textContent = rows.length;
  $('#table-range').textContent = rows.length ? `1–${rows.length} of ${rows.length} matching sample datasets` : '0 matching sample datasets';
  $('#table-empty').hidden = rows.length > 0;
  $('#selection-bar').hidden = selected.size === 0;
  $('#selection-label').textContent = `${selected.size} selected${selected.size > rows.filter((row) => selected.has(row.id)).length ? ' (including hidden rows)' : ''}`;
  $('#select-all').checked = rows.length > 0 && rows.every((row) => selected.has(row.id));
  $('#select-all').indeterminate = rows.some((row) => selected.has(row.id)) && !$('#select-all').checked;
  $('#select-all').disabled = rows.length === 0;
  document.querySelectorAll('[data-sort]').forEach((button) => {
    const active = button.dataset.sort === sort.key;
    button.closest('th').setAttribute('aria-sort', active ? sort.direction === 1 ? 'ascending' : 'descending' : 'none');
    button.querySelector('span').textContent = active ? sort.direction === 1 ? '↑' : '↓' : '↕';
  });
}
$('#filter').addEventListener('input', renderTable);
$('#clear-filter').addEventListener('click', () => { $('#filter').value = ''; renderTable(); $('#filter').focus(); });
$('#clear-selection').addEventListener('click', () => { selected.clear(); renderTable(); $('#select-all').focus(); });
$('#select-all').addEventListener('change', (event) => {
  visibleRows().forEach((row) => event.target.checked ? selected.add(row.id) : selected.delete(row.id));
  renderTable();
});
$('#dataset-rows').addEventListener('change', (event) => {
  const id = event.target.dataset.select;
  if (!id) return;
  event.target.checked ? selected.add(id) : selected.delete(id);
  renderTable();
  document.querySelector(`[data-select="${id}"]`).focus();
});
document.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => {
  sort = { key: button.dataset.sort, direction: sort.key === button.dataset.sort ? -sort.direction : 1 };
  renderTable();
}));
renderTable();

let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}
function showDialog(title, description, destructive = false) {
  $('#dialog-body').innerHTML = `<h2 id="dialog-title">${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><div class="ds-form-actions"><button class="ds-btn ds-btn-secondary" autofocus data-close>${destructive ? 'Cancel' : 'Close'}</button>${destructive ? '<button class="ds-btn ds-btn-danger" data-confirm>Delete sample branch</button>' : ''}</div>`;
  $('#dialog').showModal();
  $('#dialog [data-close]').addEventListener('click', () => $('#dialog').close());
  $('#dialog [data-confirm]')?.addEventListener('click', () => {
    $('#dialog').close();
    $('#action-note').textContent = 'Sample deletion confirmed. This reference has no connection to your projects.';
  });
}
// Keep Tab within the example dialog, including the browser-chrome boundary.
$('#dialog').addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const controls = [...$('#dialog').querySelectorAll('button:not(:disabled)')];
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
});
document.addEventListener('click', async (event) => {
  const datasetButton = event.target.closest('[data-dataset]');
  if (datasetButton) {
    const row = datasets.find((item) => item.id === datasetButton.dataset.dataset);
    showDialog(row.name, `${row.rows.toLocaleString('en-US')} rows · ${row.status} · Owner: ${row.owner}. This is synthetic reference data; no dataset is opened or changed.`);
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  switch (button.dataset.action) {
    case 'run': {
      const original = button.innerHTML;
      const originalMinWidth = button.style.minWidth;
      button.style.minWidth = `${button.offsetWidth}px`;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = '<span class="ds-spinner" aria-hidden="true"></span>Running…';
      $('#action-note').textContent = 'Running the sample query…';
      setTimeout(() => {
        button.innerHTML = original;
        button.style.minWidth = originalMinWidth;
        button.disabled = false;
        button.removeAttribute('aria-busy');
        $('#action-note').textContent = 'Sample query complete: 3 illustrative rows. No backend query was submitted.';
      }, 900);
      break;
    }
    case 'save': toast('Sample save acknowledged. Nothing is persisted by this reference.'); break;
    case 'delete': showDialog('Delete pricing-experiment?', 'This illustrates confirmation for a destructive action. In the product, the review must name the branch and explain its dependencies. This example changes no real branch.', true); break;
    case 'details': showDialog('Query details', 'Revenue by region · PostgreSQL · main · Read only. The product should show execution context before the user runs a query.'); break;
    case 'import': showDialog('Import a sample', 'The import flow reviews a file, its schema and destination before creating a table. Explore the linked wireframes for the complete journey.'); break;
    case 'copy': {
      const query = 'SELECT region, SUM(amount) AS revenue FROM public.orders GROUP BY region;';
      try { await navigator.clipboard.writeText(query); toast('Sample query copied.'); }
      catch { showDialog('Sample query', `Clipboard access is unavailable. Select and copy this query: ${query}`); }
      break;
    }
    default: toast('Example control activated.');
  }
});
$('#sample-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#project-name');
  const invalid = !input.value.trim();
  input.setAttribute('aria-invalid', String(invalid));
  $('#project-error').hidden = !invalid;
  $('#form-result').textContent = invalid ? '' : `“${input.value.trim()}” is valid. This is a preview; no project was created.`;
  if (invalid) input.focus();
});
$('#project-name').addEventListener('input', (event) => {
  if (event.target.value.trim()) { event.target.removeAttribute('aria-invalid'); $('#project-error').hidden = true; }
  $('#form-result').textContent = '';
});
$('#sample-form').addEventListener('reset', () => {
  $('#project-name').removeAttribute('aria-invalid');
  $('#project-error').hidden = true;
  $('#form-result').textContent = '';
});
function updateNavigation() {
  document.querySelectorAll('.ds-sidebar nav a').forEach((link) => {
    if (link.hash === (location.hash || '#direction')) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', updateNavigation);
updateNavigation();
