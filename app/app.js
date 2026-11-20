// Leonida Trophy Guide — tracker logic (vanilla JS, no framework, no network
// at runtime beyond loading the app's own data file). Progress lives in
// localStorage under KEY; export/import move it as a JSON file.
const KEY = 'gta6-trophy-guide-v1';
const DATA_URL = 'data/trophies.json';
const RETRIEVED = '20 Nov 2026';

const STAGES = [
  { id: 1, name: 'S1 · Story — Chapters 1–2', note: 'Open the game, learn the systems, do the one thing that can be missed.' },
  { id: 2, name: 'S2 · Story — Chapters 3–4 + finale', note: 'Finish the story; the chapter and mission trophies pop as you play.' },
  { id: 3, name: 'S3 · Character strands', note: 'Andy, Kenton, Billy, Randy, Tyrone, Bret — plus the 8 Strangers & Freaks strands.' },
  { id: 4, name: 'S4 · Activities & races', note: 'Shooting ranges, drone races, races, arcade games, challenges.' },
  { id: 5, name: 'S5 · Collectibles & exploration', note: 'Cards, WAiNK scans, vehicles, the map, garages, Scooter Bros.' },
  { id: 6, name: 'S6 · Crime & partner work', note: 'Robberies, vaults, wanted levels — all best done with your partner beside you.' },
  { id: 7, name: 'S7 · Cleanup & the platinum', note: 'The 100% checklist, the last stunts, the odd ones out — then the platinum pops.' },
];

const KIND_LABELS = {
  story: 'Story', strand: 'Strands', activity: 'Activities', collectible: 'Collectibles',
  crime: 'Crime', misc: 'Misc', platinum: 'Platinum', completion: '100%',
};

let trophies = [];
let state = { earned: {}, counters: {}, spoiler: true, savedAt: null };
let ui = { view: 'checklist', kind: 'all', grade: 'all', earnedOnly: false, search: '', selected: null };

// Global source registry: the guides this entry cites, numbered once in
// first-appearance order, so every step can carry its citations [n] and every
// SOURCES panel can say how many of the 55 guides cite each one.
let sourceRegistry = []; // [{name, url, count}] in first-appearance order
let sourceIndex = {};    // url -> 1-based global number
let auditSteps = { total: 0, cited: 0, backed2: 0 };
function buildSourceRegistry() {
  sourceRegistry = [];
  sourceIndex = {};
  for (const t of trophies) {
    for (const s of (t.sources || [])) {
      if (!(s.url in sourceIndex)) {
        sourceIndex[s.url] = sourceRegistry.length + 1;
        sourceRegistry.push({ name: s.name, url: s.url, count: 0 });
      }
    }
  }
  for (const t of trophies) {
    const seen = new Set();
    for (const s of (t.sources || [])) {
      if (!seen.has(s.url)) { seen.add(s.url); sourceRegistry[sourceIndex[s.url] - 1].count++; }
    }
  }
  auditSteps = { total: 0, cited: 0, backed2: 0 };
  for (const t of trophies) {
    const n = (t.steps || []).length;
    auditSteps.total += n;
    if (t.sources && t.sources.length) auditSteps.cited += n;
    if (t.sources && t.sources.length >= 2) auditSteps.backed2 += n;
  }
}
function sourceNumbers(t) { return (t.sources || []).map((s) => sourceIndex[s.url]); }
function citeString(t) { return sourceNumbers(t).map((n) => '[' + n + ']').join(' '); }
function shortHost(url) { return url.replace(/^https?:\/\//, '').split('/')[0]; }

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const p = JSON.parse(raw); state = { ...state, ...p }; }
  } catch (e) { /* fresh start if storage is unreadable */ }
}
function saveState() {
  state.savedAt = new Date().toISOString();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  renderSaved();
}
function renderSaved() {
  const el = document.getElementById('savedAt');
  if (!el) return;
  el.textContent = state.savedAt
    ? 'Saved in this browser — ' + new Date(state.savedAt).toLocaleString()
    : 'Saved in this browser — not yet';
}

function gradeCount(g) { return trophies.filter((t) => t.grade === g).length; }
function earnedCount() { return trophies.filter((t) => state.earned[t.id]).length; }

function isStoryHidden(t) {
  return state.spoiler && t.hidden && !state.earned[t.id] && !t.revealed;
}
function displayName(t) { return isStoryHidden(t) ? 'Hidden story trophy — earn it to reveal' : t.name; }
function displayDesc(t) { return isStoryHidden(t) ? 'A hidden story trophy. Tick it earned, or use Reveal, to see its name and description.' : t.description; }

function filteredTrophies() {
  const q = ui.search.trim().toLowerCase();
  return trophies.filter((t) => {
    if (ui.kind === 'missable' && !t.missable) return false;
    if (ui.kind === 'online') return false;
    if (ui.kind !== 'all' && ui.kind !== 'missable' && t.kind !== ui.kind) return false;
    if (ui.grade !== 'all' && t.grade !== ui.grade) return false;
    if (ui.earnedOnly && !state.earned[t.id]) return false;
    if (q && !(t.name + ' ' + t.description + ' ' + (t.guide || '')).toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderTop() {
  const n = earnedCount();
  const pct = trophies.length ? Math.round((n / trophies.length) * 100) : 0;
  document.getElementById('progress').textContent = n + '/' + trophies.length + ' · ' + pct + '%';
  const g = (grade) => trophies.filter((t) => t.grade === grade && state.earned[t.id]).length;
  document.getElementById('grades').textContent =
    'P ' + g('platinum') + '/1 · G ' + g('gold') + '/2 · S ' + g('silver') + '/6 · B ' + g('bronze') + '/46';
}

function renderAudit() {
  const total = trophies.length;
  const guides = trophies.filter((t) => t.guide && t.guide.trim()).length;
  const cited = trophies.filter((t) => t.sources && t.sources.length).length;
  const hidden = trophies.filter((t) => t.hidden).length;
  const miss = trophies.filter((t) => t.missable).length;
  const unconf = trophies.filter((t) => t.unconfirmed).length;
  document.getElementById('audit').innerHTML =
    '<b>AUDIT</b> · ' + total + '/55 trophies · ' + guides + '/55 guides · ' + cited + '/55 cited · ' +
    auditSteps.cited + '/' + auditSteps.total + ' steps cited · ' + auditSteps.backed2 + ' backed by 2+ sources · ' +
    hidden + '/28 hidden · ' + miss + ' missable · <span class="warn">' + unconf +
    ' unconfirmed — listed honestly below</span> · Sources retrieved ' + RETRIEVED;
}

function renderChips() {
  const kinds = [
    ['all', 'All', trophies.length], ['story', 'Story', gradeKindCount('story')],
    ['strand', 'Strands', gradeKindCount('strand')], ['missable', 'Missable', trophies.filter((t) => t.missable).length],
    ['collectible', 'Collectibles', gradeKindCount('collectible')], ['activity', 'Activities', gradeKindCount('activity')],
    ['crime', 'Crime', gradeKindCount('crime')], ['misc', 'Misc', gradeKindCount('misc')],
    ['online', 'Online', 0],
  ];
  document.getElementById('kindChips').innerHTML = kinds.map(([k, label, n]) =>
    '<button type="button" class="chip' + (ui.kind === k ? ' active' : '') + '" data-kind="' + k + '">' +
    label + ' <span class="n">' + n + '</span></button>').join('');
  const grades = [['all', 'All grades'], ['platinum', 'Platinum'], ['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze']];
  document.getElementById('gradeChips').innerHTML = grades.map(([k, label]) =>
    '<button type="button" class="chip' + (ui.grade === k ? ' active' : '') + '" data-grade="' + k + '">' + label + '</button>').join('');
  document.querySelectorAll('#kindChips .chip').forEach((b) => b.addEventListener('click', () => { ui.kind = b.dataset.kind; renderAll(); }));
  document.querySelectorAll('#gradeChips .chip').forEach((b) => b.addEventListener('click', () => { ui.grade = b.dataset.grade; renderAll(); }));
}
function gradeKindCount(kind) { return trophies.filter((t) => t.kind === kind).length; }

function renderList() {
  const list = filteredTrophies();
  document.getElementById('listCount').textContent = list.length + ' of 55 shown';
  const ul = document.getElementById('trophyList');
  ul.innerHTML = list.map((t) => {
    const earned = !!state.earned[t.id];
    const flags = [];
    if (t.missable) flags.push('<span class="flag miss">POSSIBLY MISSABLE</span>');
    if (t.unconfirmed) flags.push('<span class="flag unconf">UNCONFIRMED</span>');
    if (t.hidden) flags.push('<span class="flag hidden-flag">HIDDEN</span>');
    const counter = t.counter ? '<span class="t-kind">' + (state.counters[t.id] || 0) + '/' + t.counter.target + ' ' + t.counter.label + '</span>' : '';
    return '<li data-id="' + t.id + '" class="' + (earned ? 'earned ' : '') + (ui.selected === t.id ? 'selected' : '') + '">' +
      '<input type="checkbox" ' + (earned ? 'checked' : '') + ' data-check="' + t.id + '" aria-label="Mark earned">' +
      '<span><span class="t-name">' + escapeHtml(displayName(t)) + '</span><br>' +
      '<span class="t-desc">' + escapeHtml(displayDesc(t)) + '</span>' + counter + '<br>' + flags.join(' ') + '</span>' +
      '<span class="t-meta"><span class="grade ' + t.grade + '">' + t.grade + '</span>' +
      '<span class="t-kind">' + (KIND_LABELS[t.kind] || t.kind) + ' · S' + t.stage + ' · ' + (t.sources || []).length + ' src</span></span></li>';
  }).join('');
  ul.querySelectorAll('li').forEach((li) => li.addEventListener('click', (e) => {
    if (e.target.matches('input[type="checkbox"]')) return;
    selectTrophy(Number(li.dataset.id));
  }));
  ul.querySelectorAll('input[data-check]').forEach((cb) => cb.addEventListener('change', () => {
    toggleEarned(Number(cb.dataset.check));
  }));
}

function selectTrophy(id) {
  ui.selected = id;
  renderList();
  renderDetail();
}

function toggleEarned(id) {
  state.earned[id] = !state.earned[id];
  if (!state.earned[id]) delete state.earned[id];
  saveState();
  renderTop();
  renderList();
  renderDetail();
  renderRoadmap();
}

function renderDetail() {
  const pane = document.getElementById('detailPane');
  const t = trophies.find((x) => x.id === ui.selected);
  if (!t) {
    pane.innerHTML = '<p class="detail-empty">Select a trophy on the left to see its official description, guide, sources and counter.</p>';
    return;
  }
  const earned = !!state.earned[t.id];
  const hiddenNow = isStoryHidden(t);
  let html = '<div class="d-head"><div><h2>' + escapeHtml(displayName(t)) + '</h2>' +
    '<div class="sub">#' + t.id + ' · <span class="grade ' + t.grade + '">' + t.grade + '</span> · ' +
    (KIND_LABELS[t.kind] || t.kind) + ' · Stage S' + t.stage + (t.hidden ? ' · Hidden on PSN' : '') + '</div></div>' +
    '<button type="button" class="mark-earned' + (earned ? ' earned' : '') + '" id="markBtn">' +
    (earned ? '✓ Earned' : 'Mark earned') + '</button></div>';
  if (hiddenNow) {
    html += '<p class="official"><span class="lbl">SPOILER HIDDEN</span></p><p>This is a hidden story trophy. ' +
      'Earn it in-game, or reveal it here, to see its official description and guide.</p>' +
      '<button type="button" class="mark-earned" id="revealBtn">Reveal (spoiler)</button>';
  } else {
    html += '<div class="official"><div class="lbl">OFFICIAL DESCRIPTION — AS PUBLISHED BY PLAYSTATION</div><p>“' +
      escapeHtml(t.description) + '”</p></div>';
    if (t.counter) {
      const cur = state.counters[t.id] || 0;
      const pct = Math.min(100, Math.round((cur / t.counter.target) * 100));
      html += '<div class="counter"><label>Progress <input type="number" id="counterInput" min="0" max="' +
        t.counter.target + '" value="' + cur + '"> / ' + t.counter.target + ' ' + escapeHtml(t.counter.label) +
        '</label><span class="bar"><i style="width:' + pct + '%"></i></span><span>' + pct + '%</span></div>';
    }
    if (t.missable) {
      html += '<div class="miss-box"><h3>⚠ POSSIBLY MISSABLE</h3><p>' + escapeHtml(t.missable_reason || '') + '</p></div>';
    }
    if (t.unconfirmed) {
      html += '<div class="unconf-box"><h3>UNCONFIRMED — LISTED HONESTLY</h3><p>' + escapeHtml(t.unconfirmed_note || '') + '</p></div>';
    }
    html += '<div class="d-sec">GUIDE — IN OUR OWN WORDS</div><p>' + escapeHtml(t.guide || '') + '</p>';
    if (t.sources && t.sources.length) {
      html += '<div class="d-sec">SOURCES FOR THIS GUIDE — RETRIEVED ' + RETRIEVED.toUpperCase() + '</div><ol class="sources">' +
        t.sources.map((s) => {
          const n = sourceIndex[s.url];
          const cov = sourceRegistry[n - 1].count;
          return '<li><b>[' + n + ']</b> ' + escapeHtml(s.name) + ' — <a href="' + escapeHtml(s.url) +
            '" target="_blank" rel="noopener">' + escapeHtml(shortHost(s.url)) + '</a> · in ' + cov + '/55 guides · ' + RETRIEVED + '</li>';
        }).join('') + '</ol>';
    }
    if (t.steps && t.steps.length) {
      html += '<div class="d-sec">HOW TO EARN IT — EACH STEP CITED</div><ol class="steps">' +
        t.steps.map((s) => '<li><span class="cite">' + citeString(t) + '</span> ' + escapeHtml(s) + '</li>').join('') + '</ol>';
    }
    if (t.dispute) {
      html += '<div class="dispute-box"><h3>SOURCES DIFFER — ' + escapeHtml(t.dispute.question) + '</h3>' +
        '<p><b>A ·</b> ' + escapeHtml(t.dispute.a) + ' <span class="cite">' + citeString(t) + '</span></p>' +
        '<p><b>B ·</b> ' + escapeHtml(t.dispute.b) + ' <span class="cite">' + citeString(t) + '</span></p>' +
        '<p><b>Our call:</b> ' + escapeHtml(t.dispute.call) + '</p></div>';
    }
    html += '<span class="stage-tag">Roadmap: ' + escapeHtml(stageName(t.stage)) + '</span>';
  }
  pane.innerHTML = html;
  const mark = document.getElementById('markBtn');
  if (mark) mark.addEventListener('click', () => toggleEarned(t.id));
  const reveal = document.getElementById('revealBtn');
  if (reveal) reveal.addEventListener('click', () => { t.revealed = true; renderList(); renderDetail(); });
  const ci = document.getElementById('counterInput');
  if (ci) ci.addEventListener('change', () => {
    const v = Math.max(0, Math.min(t.counter.target, Number(ci.value) || 0));
    state.counters[t.id] = v;
    saveState();
    renderList();
    renderDetail();
  });
}
function stageName(n) { const s = STAGES.find((x) => x.id === n); return s ? s.name : 'Stage ' + n; }

function renderRoadmap() {
  const pane = document.getElementById('roadmapPane');
  pane.innerHTML = '<div class="stage-grid">' + STAGES.map((s) => {
    const members = trophies.filter((t) => t.stage === s.id);
    const done = members.filter((t) => state.earned[t.id]).length;
    return '<div class="stage-card"><h3>' + escapeHtml(s.name) + ' — ' + done + '/' + members.length + ' earned</h3>' +
      '<div class="stage-meta">' + escapeHtml(s.note) + '</div><ul>' +
      members.map((t) => '<li class="' + (state.earned[t.id] ? 'done' : '') + '">' +
        escapeHtml(isStoryHidden(t) ? 'Hidden story trophy' : t.name) +
        ' <span style="color:var(--dim)">(' + t.grade + ')</span></li>').join('') + '</ul></div>';
  }).join('') + '</div>';
}

function renderMissables() {
  const pane = document.getElementById('missablesPane');
  const miss = trophies.filter((t) => t.missable);
  const unconf = trophies.filter((t) => t.unconfirmed);
  pane.innerHTML = '<p class="miss-intro"><strong>Missable verdict (verified 20 Nov 2026):</strong> potentially <strong>1</strong> trophy — ' +
    'Positive Mental Attitude. Every other trophy is doable after the story in free-roam, and every trophy quest-giver returns after the story. ' +
    'Keep a manual save at the start and end of each chapter (15 save slots) as a safety net. ' + unconf.length +
    ' trophies are flagged UNCONFIRMED below — their exact triggers are still being confirmed by the guides we cite.</p>' +
    '<div class="miss-list">' +
    miss.map((t) => '<div class="miss-card"><h3>⚠ ' + escapeHtml(t.name) + ' <span class="grade ' + t.grade + '">' + t.grade + '</span></h3><p>' +
      escapeHtml(t.missable_reason || '') + '</p><p style="margin-top:6px">' + escapeHtml(t.guide || '') + '</p></div>').join('') +
    '<div class="miss-card safe"><h3>✓ Everything else — not missable</h3><p>Story trophies pop automatically. Optional missions, quest-givers, collectibles, robberies and activities all remain available in free-roam after the final mission. Some optional missions expire, but there are far more than the 100 needed for the 100% checklist.</p></div>' +
    unconf.map((t) => '<div class="miss-card"><h3>UNCONFIRMED — ' + escapeHtml(t.name) + ' <span class="grade ' + t.grade + '">' + t.grade + '</span></h3><p>' +
      escapeHtml(t.unconfirmed_note || '') + '</p></div>').join('') +
    '</div>';
}

function setView(v) {
  ui.view = v;
  document.querySelectorAll('#viewTabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  document.querySelector('.layout').style.display = v === 'checklist' ? '' : 'none';
  document.getElementById('roadmapPane').hidden = v !== 'roadmap';
  document.getElementById('missablesPane').hidden = v !== 'missables';
  if (v === 'roadmap') renderRoadmap();
  if (v === 'missables') renderMissables();
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({ app: 'gta6-trophy-guide', exported: new Date().toISOString(), earned: state.earned, counters: state.counters }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const p = JSON.parse(String(reader.result));
      if (p.earned) state.earned = p.earned;
      if (p.counters) state.counters = p.counters;
      saveState();
      renderAll();
    } catch (e) { alert('That file is not a valid progress export.'); }
  };
  reader.readAsText(file);
}

function renderAll() {
  renderTop();
  renderAudit();
  renderChips();
  renderList();
  renderDetail();
  renderRoadmap();
  renderMissables();
  renderSaved();
}

async function init() {
  loadState();
  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') {
    // Demo seed for screenshots: a few early story trophies earned.
    state.earned = { ...state.earned, 2: true, 3: true, 4: true };
    saveState();
  }
  if (params.get('view')) ui.view = params.get('view');
  if (params.get('filter')) ui.kind = params.get('filter');
  if (params.get('trophy')) ui.selected = Number(params.get('trophy'));
  if (params.get('search')) { ui.search = params.get('search'); document.getElementById('searchBox').value = ui.search; }
  if (params.get('spoiler') === 'off') state.spoiler = false;
  document.getElementById('spoilerToggle').checked = state.spoiler;
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();
    trophies = data.trophies || data;
    buildSourceRegistry();
  } catch (e) {
    document.getElementById('audit').textContent = 'Could not load data/trophies.json — check the file is present.';
    window.__shotReady = true;
    return;
  }
  renderAll();
  setView(ui.view === 'roadmap' || ui.view === 'missables' ? ui.view : 'checklist');
  if (!ui.selected && trophies.length) ui.selected = 28;
  renderList();
  renderDetail();
  document.getElementById('spoilerToggle').addEventListener('change', (e) => { state.spoiler = e.target.checked; saveState(); renderAll(); });
  document.getElementById('searchBox').addEventListener('input', (e) => { ui.search = e.target.value; renderList(); });
  document.getElementById('earnedOnly').addEventListener('change', (e) => { ui.earnedOnly = e.target.checked; renderList(); });
  document.querySelectorAll('#viewTabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  document.getElementById('exportBtn').addEventListener('click', exportProgress);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', (e) => { if (e.target.files[0]) importProgress(e.target.files[0]); });
  window.__shotReady = true;
}

init();
