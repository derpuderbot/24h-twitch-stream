(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = { config: null, base: null, dirty: false, lastSaved: null };
  const GROUPS = [
    ['texts', 'Texte & Beschriftungen', 'Website-Titel, Untertitel, Footer und alle sichtbaren Labels.'],
    ['design', 'Design & Typografie', 'Farben, Google-Fonts, Schriftgröße, Scanlines, Animationen und Effekte.'],
    ['layout', 'Layout & Bereiche', 'Reihenfolge, Breite und Sichtbarkeit der einzelnen Website-Bereiche sowie Chat-Anordnung.'],
    ['player', 'Twitch-Player', 'Standardansicht, Chat, Stummschaltung und Chat-Höhe.'],
    ['event', 'Event & Laufzeit', 'Startzeit, Dauer und Event-Meilensteine in Stunden.'],
    ['data', 'Daten & Statistiken', 'Aktualisierungsintervall, Fallback, TwitchTracker und Follower-Meilensteine.'],
    ['streamers', 'Streamer & Profile', 'Kanallogins, Anzeigenamen, Avatare, Beschreibungen und beliebig viele Links.'],
    ['lists', 'Listen & Inhalte', 'Zeitplan, Spiele, Challenges, Clips, Community- und weitere Links.'],
    ['sources', 'Quellenverzeichnis', 'Öffentliche Quellen und Hinweise zur Herkunft der angezeigten Daten.']
  ];
  const LABELS = {
    version: 'Konfigurationsversion', brand: 'Markenname', heroEyebrow: 'Hero-Kennzeile', heroTitle: 'Hero-Titel', heroAccent: 'Hero-Akzentzeile', heroSubtitle: 'Hero-Untertitel', footerBrand: 'Footer-Marke', footerText: 'Footer-Text', labels: 'Beschriftungen', live: 'Live-Label', offline: 'Offline-Label', unknown: 'Unbekannt / N/A', countdown: 'Countdown-Beschriftung', running: 'Laufzeit-Beschriftung', finished: 'Abgeschlossen-Beschriftung', eventProgress: 'Fortschrittslabel', noSchedule: 'Text ohne Zeitplan', noClips: 'Text ohne Clips', noLinks: 'Text ohne Links',
    accent: 'Akzentfarbe', accent2: 'Akzentfarbe 2', background: 'Hintergrundfarbe', backgroundPanel: 'Panel-Hintergrund', text: 'Textfarbe', muted: 'Sekundärtextfarbe', danger: 'Fehlerfarbe', headingFont: 'Schriftart Überschriften', bodyFont: 'Schriftart Fließtext', headingFallback: 'Fallback Überschriften', bodyFallback: 'Fallback Fließtext', baseFontSize: 'Grundschriftgröße (px)', maxPageWidth: 'Maximale Seitenbreite (px)', scanlines: 'Scanlines aktivieren', animations: 'Animationen aktivieren', glowStrength: 'Glow-Stärke (px)', borderStrength: 'Rahmenstärke (px)',
    order: 'Bereichsreihenfolge', sections: 'Bereichseinstellungen', visible: 'Bereich sichtbar', width: 'Bereichsbreite', chatPosition: 'Chat-Position', full: 'Vollbreite', dual: 'Doppelansicht', defaultView: 'Standardansicht', chatEnabled: 'Chat standardmäßig anzeigen', muted: 'Stumm starten', chatHeight: 'Chat-Höhe (px)', startAt: 'Event-Start (ISO / lokale Zeit)', durationHours: 'Eventdauer (Stunden)', milestonesHours: 'Event-Meilensteine (Stunden)', refreshSeconds: 'Aktualisierungsintervall (Sekunden)', liveFallback: 'DecAPI-Live-Fallback aktivieren', twitchTrackerRows: 'TwitchTracker-Zeilen anzeigen', followerMilestones: 'Follower-Meilensteine', historyDays: 'Verlauf aufbewahren (Tage)', streamers: 'Streamer', id: 'Interne ID (a oder b)', login: 'Twitch-Login', displayName: 'Anzeigename', profileImageUrl: 'Profilbild-URL (optional)', bio: 'Beschreibung', descriptionSource: 'Quelle der Beschreibung', links: 'Links', label: 'Anzeigename des Links', url: 'URL', type: 'Linktyp', schedule: 'Streamplan / Programmpunkte', time: 'Zeit / Zeitmarker', title: 'Titel', description: 'Beschreibung', games: 'Geplante Spiele', challenges: 'Challenges', clips: 'Clips & Highlights', social: 'Social Media / Discord / Community', note: 'Quellenhinweis', owner: 'GitHub-Benutzer / Organisation', repo: 'Repository', branch: 'Branch'
  };
  const HELP = {
    'design.headingFont': 'Google-Font-Familienname, zum Beispiel Orbitron, Rajdhani oder Inter. Ein Browser-Fallback wird verwendet.',
    'layout.order': 'JSON-Array mit Bereichs-IDs. Gültig: hero, streamers, player, dashboard, program, clips, links.',
    'layout.sections': 'Pro Bereich visible (true/false) und width: full, ⅔, half oder ⅓ festlegen.',
    'layout.chatPosition': 'below = beide Chats unter den Playern; side = Chat direkt neben dem jeweiligen Stream.',
    'event.startAt': 'ISO-Zeitstempel, beispielsweise 2026-11-21T18:00:00+01:00. Leer lassen, wenn der Termin noch nicht feststeht.',
    'streamers': 'Zwei Objekte verwenden. id „a“ und „b“ ordnen die Streamer den Playern zu. Links sind beliebig erweiterbar.',
    'lists.schedule': 'Array aus Objekten mit time, title und description.',
    'lists.games': 'Array aus Spielnamen oder Objekten mit name.',
    'lists.challenges': 'Array aus Texten oder Objekten mit title.',
    'lists.clips': 'Array aus Objekten mit url, title und optional thumbnail_url / creator_name.',
    'lists.social': 'Öffentliche, verifizierte Community-/Social-Links; unbestätigte Einladungen nicht eintragen.',
    'data.refreshSeconds': 'Die GitHub-Actions aktualisieren alle 15 Minuten. Browser-Fallback wird mit diesem Intervall geprüft; Mindestwert 60.',
    'data.twitchTrackerRows': 'TwitchTracker liefert keine stabile dokumentierte API. Fehlerhafte oder blockierte Antworten werden als nicht verfügbar markiert.'
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jsonPath = path => JSON.stringify(path);
  function toast(message, error = false) {
    const node = document.createElement('div'); node.className = `config-toast${error ? ' error' : ''}`; node.textContent = message;
    $('#toast-region').append(node); setTimeout(() => node.remove(), 5000);
  }
  function setDirty(value = true) {
    state.dirty = value; $('#dirty-indicator').classList.toggle('dirty', value);
    $('#config-state').textContent = value ? 'UNGESPEICHERTE ÄNDERUNGEN' : 'KONFIGURATION SYNCHRON';
    $('#config-updated').textContent = `LETZTE ÄNDERUNG: ${state.lastSaved ? new Date(state.lastSaved).toLocaleString('de-DE') : 'ENTWURF'}`;
    $('#raw-json').value = JSON.stringify(state.config, null, 2);
  }
  async function remoteConfig() {
    const response = await fetch(`data/config.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`data/config.json konnte nicht geladen werden (HTTP ${response.status}).`);
    return response.json();
  }
  async function loadInitial() {
    let config = clone(window.DEFAULT_CONFIG || {});
    try { config = merge(config, await remoteConfig()); } catch (error) { toast(error.message, true); }
    try {
      const local = localStorage.getItem('24h_twitch_config_override');
      if (local) config = merge(config, JSON.parse(local));
    } catch (error) { toast(`Lokaler Entwurf konnte nicht gelesen werden: ${error.message}`, true); }
    state.config = config; state.base = clone(config); renderEditor(); setDirty(false);
    try { const token = localStorage.getItem('24h_twitch_github_token'); if (token) { $('#gh-token').value = token; $('#remember-token').checked = true; } } catch {}
  }
  function merge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (base && typeof base === 'object') { const out = { ...base }; if (over && typeof over === 'object' && !Array.isArray(over)) Object.entries(over).forEach(([k,v]) => out[k] = k in base ? merge(base[k], v) : v); return out; }
    return over === undefined ? base : over;
  }
  function labelFor(key) { return LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()); }
  function isWide(key, value) { return Array.isArray(value) || (value && typeof value === 'object') || ['heroSubtitle','footerText','bio','description','note','descriptionSource','sources','schedule','streamers','social','challenges','clips','games','order','milestonesHours','followerMilestones'].includes(key); }
  function renderEditor() {
    const nav = $('#config-nav'), root = $('#config-sections'); nav.innerHTML = ''; root.innerHTML = '';
    GROUPS.forEach(([key, title, description], index) => {
      const link = document.createElement('a'); link.href = `#group-${key}`; link.textContent = `${String(index+1).padStart(2,'0')}  ${title}`; if (!index) link.classList.add('active'); nav.append(link);
      if (!(key in state.config)) state.config[key] = key === 'sources' ? [] : {};
      const group = document.createElement('section'); group.className = 'config-group'; group.id = `group-${key}`;
      group.innerHTML = `<div class="group-head"><div><h2>${escapeHtml(title.toUpperCase())}</h2><p>${escapeHtml(description)}</p></div><span class="group-tag">${escapeHtml(key.toUpperCase())}</span></div>`;
      const fields = document.createElement('div'); fields.className = 'field-grid';
      if (Array.isArray(state.config[key])) fields.append(makeField([key], state.config[key]));
      else Object.entries(state.config[key] || {}).forEach(([field, value]) => fields.append(makeField([key, field], value)));
      group.append(fields); root.append(group);
    });
    $('#raw-json').value = JSON.stringify(state.config, null, 2);
    // Sidebar active state follows the visible section.
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) $$('#config-nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
    }), { rootMargin: '-100px 0px -65% 0px' });
    $$('.config-group').forEach(group => observer.observe(group));
  }
  function makeField(path, value) {
    const key = path[path.length - 1], pathText = path.join('.'), field = document.createElement('div');
    field.className = `config-field${isWide(key, value) ? ' wide' : ''}`;
    if (Array.isArray(value)) {
      field.innerHTML = `<label>${escapeHtml(labelFor(key))}<span class="field-path">${escapeHtml(pathText)}</span></label><textarea spellcheck="false" data-array-path='${escapeHtml(jsonPath(path))}'>${escapeHtml(JSON.stringify(value, null, 2))}</textarea><div class="field-hint">JSON-Array bearbeiten. Einträge können ergänzt, entfernt und umsortiert werden.</div>`;
      const hint = HELP[pathText]; if (hint) field.querySelector('.field-hint').textContent = hint;
      const textarea = field.querySelector('textarea');
      textarea.addEventListener('change', () => {
        try { const parsed = JSON.parse(textarea.value); if (!Array.isArray(parsed)) throw new Error('Es wird ein JSON-Array erwartet.'); updatePath(path, parsed); textarea.classList.remove('invalid-field'); setDirty(); }
        catch (error) { textarea.classList.add('invalid-field'); toast(`${pathText}: ${error.message}`, true); }
      });
      return field;
    }
    if (value && typeof value === 'object') {
      field.className = 'object-field'; field.innerHTML = `<div class="object-title">${escapeHtml(labelFor(key).toUpperCase())}<span class="field-path">${escapeHtml(pathText)}</span></div>`;
      const subgrid = document.createElement('div'); subgrid.className = 'field-grid';
      Object.entries(value).forEach(([child, childValue]) => subgrid.append(makeField([...path, child], childValue)));
      field.append(subgrid); return field;
    }
    const help = HELP[pathText] || '';
    const pathAttr = escapeHtml(jsonPath(path));
    if (typeof value === 'boolean') {
      field.innerHTML = `<label>${escapeHtml(labelFor(key))}<span class="field-path">${escapeHtml(pathText)}</span></label><div class="boolean-field"><input type="checkbox" data-path='${pathAttr}' ${value ? 'checked' : ''}><span class="field-hint">${escapeHtml(help || 'Aktiviert / deaktiviert')}</span></div>`;
      field.querySelector('input').addEventListener('change', event => { updatePath(path, event.target.checked); setDirty(); }); return field;
    }
    if (key === 'headingFont' || key === 'bodyFont') {
      const fonts = ['Orbitron','Inter','Rajdhani','Roboto','Space Grotesk','Exo 2','IBM Plex Sans','Share Tech Mono','Montserrat','Source Sans 3','Fira Sans','Titillium Web'];
      const selected = fonts.includes(String(value)) ? String(value) : '__custom__';
      const options = fonts.map(font => `<option value="${escapeHtml(font)}" ${String(value) === font ? 'selected' : ''}>${escapeHtml(font)}</option>`).join('') + `<option value="__custom__" ${selected === '__custom__' ? 'selected' : ''}>Eigene Schriftart</option>`;
      field.innerHTML = `<label>${escapeHtml(labelFor(key))}<span class="field-path">${escapeHtml(pathText)}</span></label><select data-font-select>${options}</select><input type="text" data-path='${pathAttr}' value="${escapeHtml(value)}" placeholder="Google-Font-Familienname"><div class="field-hint">Auswahl aus Google Fonts oder eigenen Familiennamen eintragen.</div>`;
      const select = field.querySelector('[data-font-select]'), input = field.querySelector('[data-path]');
      select.addEventListener('change', () => { if (select.value !== '__custom__') { input.value = select.value; updatePath(path, select.value); setDirty(); } else { input.focus(); } });
      input.addEventListener('change', () => { updatePath(path, input.value.trim()); select.value = fonts.includes(input.value.trim()) ? input.value.trim() : '__custom__'; setDirty(); });
      return field;
    }
    if (typeof value === 'number') {
      field.innerHTML = `<label>${escapeHtml(labelFor(key))}<span class="field-path">${escapeHtml(pathText)}</span></label><input type="number" step="any" data-path='${pathAttr}' value="${escapeHtml(value)}"><div class="field-hint">${escapeHtml(help)}</div>`;
      field.querySelector('input').addEventListener('change', event => { const number = Number(event.target.value); if (!Number.isFinite(number)) return; updatePath(path, number); setDirty(); }); return field;
    }
    const str = String(value ?? ''), isColor = /(^|\.)(accent|accent2|background|backgroundPanel|text|muted|danger)$/.test(pathText) && /^#[0-9a-f]{6}$/i.test(str);
    const isDate = key === 'startAt';
    const isLong = str.length > 70 || ['heroSubtitle','footerText','bio','description','note','descriptionSource','headingFallback','bodyFallback'].includes(key);
    if (isColor) {
      field.innerHTML = `<label>${escapeHtml(labelFor(key))}<span class="field-path">${escapeHtml(pathText)}</span></label><div class="color-control"><input type="color" value="${escapeHtml(str)}" data-color-path='${pathAttr}'><input type="text" value="${escapeHtml(str)}" data-path='${pathAttr}'></div>`;
      const color = field.querySelector('[data-color-path]'), text = field.querySelector('[data-path]');
      color.addEventListener('input', () => { text.value = color.value; updatePath(path, color.value); setDirty(); });
      text.addEventListener('change', () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) { color.value = text.value; updatePath(path, text.value); setDirty(); } else toast('Bitte einen HEX-Farbwert wie #46e1e7 eingeben.', true); });
    } else {
      const type = isDate ? 'datetime-local' : (/url/i.test(key) ? 'url' : 'text');
      let shown = str;
      if (isDate && str) { const date = new Date(str); if (!Number.isNaN(date.getTime())) { const local = new Date(date.getTime() - date.getTimezoneOffset()*60000); shown = local.toISOString().slice(0,16); } }
      field.innerHTML = `<label>${escapeHtml(labelFor(key))}<span class="field-path">${escapeHtml(pathText)}</span></label>${isLong ? `<textarea data-path='${pathAttr}'>${escapeHtml(shown)}</textarea>` : `<input type="${type}" data-path='${pathAttr}' value="${escapeHtml(shown)}">`}<div class="field-hint">${escapeHtml(help)}</div>`;
      field.querySelector('[data-path]').addEventListener('change', event => {
        let next = event.target.value;
        if (isDate && next) { const date = new Date(next); if (!Number.isNaN(date.getTime())) next = date.toISOString(); }
        updatePath(path, next); setDirty();
      });
    }
    return field;
  }
  function updatePath(path, value) {
    let target = state.config;
    for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
    target[path[path.length - 1]] = value;
  }
  function validateConfig(config) {
    const problems = [];
    if (!Array.isArray(config.streamers) || config.streamers.length < 2) problems.push('Es müssen mindestens zwei Streamer konfiguriert sein.');
    const logins = (config.streamers || []).map(x => x.login).filter(Boolean);
    if (logins.length < 2) problems.push('Beide Streamer benötigen einen Twitch-Login.');
    if (config.event?.startAt && Number.isNaN(new Date(config.event.startAt).getTime())) problems.push('Event-Startzeit ist kein gültiger ISO-Zeitstempel.');
    if (Number(config.event?.durationHours) <= 0) problems.push('Eventdauer muss größer als 0 sein.');
    if (!Array.isArray(config.layout?.order)) problems.push('layout.order muss ein JSON-Array sein.');
    return problems;
  }
  function serialize() {
    const errors = validateConfig(state.config); if (errors.length) throw new Error(errors.join('\n'));
    return `${JSON.stringify(state.config, null, 2)}\n`;
  }
  function saveLocal() {
    try { const text = serialize(); localStorage.setItem('24h_twitch_config_override', text); state.base = clone(state.config); state.lastSaved = Date.now(); setDirty(false); toast('Konfiguration wurde lokal in diesem Browser gespeichert.'); }
    catch (error) { toast(`Lokales Speichern fehlgeschlagen: ${error.message}`, true); }
  }
  function downloadJson() {
    try { const blob = new Blob([serialize()], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'config.json'; a.click(); URL.revokeObjectURL(url); }
    catch (error) { toast(error.message, true); }
  }
  async function copyJson() {
    try { await navigator.clipboard.writeText(serialize()); toast('JSON-Konfiguration wurde kopiert.'); }
    catch (error) { toast(`Kopieren nicht möglich: ${error.message}`, true); }
  }
  async function importJson(file) {
    try { const parsed = JSON.parse(await file.text()); const errors = validateConfig(parsed); if (errors.length) throw new Error(errors.join('\n')); state.config = parsed; renderEditor(); setDirty(); toast('JSON wurde in den Editor übernommen.'); }
    catch (error) { toast(`JSON-Import fehlgeschlagen: ${error.message}`, true); }
  }
  async function reloadRemote(clearLocal = false) {
    try {
      const remote = await remoteConfig();
      if (clearLocal) { try { localStorage.removeItem('24h_twitch_config_override'); } catch {} }
      state.config = merge(clone(window.DEFAULT_CONFIG || {}), remote); state.base = clone(state.config); state.lastSaved = Date.now(); renderEditor(); setDirty(false); toast('Konfiguration vom Repository geladen.');
    } catch (error) { toast(error.message, true); }
  }
  function resetDefaults() {
    if (!confirm('Alle aktuellen Änderungen im Editor durch die Standardwerte aus js/defaults.js ersetzen?')) return;
    state.config = clone(window.DEFAULT_CONFIG || {}); renderEditor(); setDirty(true); toast('Standardwerte geladen. Bitte lokal oder auf GitHub speichern.');
  }
  function tokenSavePreference() {
    try {
      if ($('#remember-token').checked && $('#gh-token').value.trim()) localStorage.setItem('24h_twitch_github_token', $('#gh-token').value.trim());
      else localStorage.removeItem('24h_twitch_github_token');
    } catch (error) { toast(`Token konnte nicht gespeichert werden: ${error.message}`, true); }
  }
  function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text); let binary = ''; bytes.forEach(byte => binary += String.fromCharCode(byte)); return btoa(binary);
  }
  async function saveGithub() {
    let content;
    try { content = serialize(); } catch (error) { toast(error.message, true); return; }
    const owner = $('#gh-owner').value.trim(), repo = $('#gh-repo').value.trim(), branch = $('#gh-branch').value.trim() || 'main', token = $('#gh-token').value.trim();
    if (!owner || !repo || !token) { toast('GitHub-Benutzer, Repository und Fine-grained Token sind erforderlich.', true); return; }
    tokenSavePreference();
    const button = $('#save-github'); button.disabled = true; button.textContent = 'SPEICHERE …';
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/data/config.json`;
    const headers = { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
    try {
      let sha;
      const get = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
      if (get.ok) sha = (await get.json()).sha;
      else if (get.status !== 404) { const body = await get.json().catch(() => ({})); throw new Error(body.message || `GitHub-Lesezugriff fehlgeschlagen (HTTP ${get.status}).`); }
      const payload = { message: 'Website-Konfiguration aktualisiert', content: encodeBase64Utf8(content), branch };
      if (sha) payload.sha = sha;
      const put = await fetch(endpoint, { method: 'PUT', headers, body: JSON.stringify(payload) });
      const result = await put.json().catch(() => ({}));
      if (!put.ok) throw new Error(result.message || `GitHub-Schreibzugriff fehlgeschlagen (HTTP ${put.status}).`);
      state.base = clone(state.config); state.lastSaved = Date.now(); setDirty(false);
      toast('Konfiguration wurde auf GitHub committed. Der Pages-Workflow wird durch den Push ausgelöst.');
    } catch (error) { toast(`GitHub-Speichern fehlgeschlagen: ${error.message}`, true); }
    finally { button.disabled = false; button.textContent = 'AUF GITHUB SPEICHERN ↗'; }
  }
  function applyRawJson() {
    try { const parsed = JSON.parse($('#raw-json').value); const errors = validateConfig(parsed); if (errors.length) throw new Error(errors.join('\n')); state.config = parsed; renderEditor(); setDirty(true); toast('Vollständige JSON-Konfiguration übernommen.'); }
    catch (error) { toast(`JSON ist ungültig: ${error.message}`, true); }
  }
  function formatRawJson() {
    try { $('#raw-json').value = JSON.stringify(JSON.parse($('#raw-json').value), null, 2); }
    catch (error) { toast(`JSON kann nicht formatiert werden: ${error.message}`, true); }
  }
  $('#save-local').addEventListener('click', saveLocal);
  $('#download-json').addEventListener('click', downloadJson);
  $('#copy-json').addEventListener('click', copyJson);
  $('#import-json').addEventListener('change', event => { if (event.target.files[0]) importJson(event.target.files[0]); event.target.value = ''; });
  $('#save-github').addEventListener('click', saveGithub);
  $('#remember-token').addEventListener('change', tokenSavePreference);
  $('#gh-token').addEventListener('change', tokenSavePreference);
  $('#reload-config').addEventListener('click', () => { if (!state.dirty || confirm('Ungespeicherte Änderungen verwerfen und Repository-Version neu laden?')) reloadRemote(true); });
  $('#discard-local').addEventListener('click', () => { if (confirm('Lokale Browser-Konfiguration und alle nicht gespeicherten Änderungen verwerfen?')) reloadRemote(true); });
  $('#reset-defaults').addEventListener('click', resetDefaults);
  $('#apply-json').addEventListener('click', applyRawJson);
  $('#format-json').addEventListener('click', formatRawJson);
  loadInitial();
})();
