(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const UNKNOWN = 'N/A';
  const params = new URLSearchParams(location.search);
  const isObs = params.get('obs') === '1';
  const skipLocalConfig = params.get('nocfg') === '1';
  const state = { config: null, stats: null, history: { samples: [] }, clips: [], dataSource: 'Wird initialisiert', errors: [], view: 'dual', eventTimer: null, pollTimer: null };

  const safe = (value, fallback = UNKNOWN) => value === null || value === undefined || value === '' ? fallback : value;
  const fmt = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? UNKNOWN : new Intl.NumberFormat('de-DE').format(Number(value));
  const timeFmt = value => {
    if (!value) return UNKNOWN;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? UNKNOWN : new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const validUrl = value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  };
  const toast = (message, type = '') => {
    const region = $('#toast-region'); if (!region) return;
    const node = document.createElement('div'); node.className = `toast ${type}`; node.textContent = message; region.append(node);
    setTimeout(() => node.remove(), 4200);
  };
  const setText = (selector, value) => { const node = $(selector); if (node) node.textContent = safe(value, ''); };
  const readJson = async path => {
    const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  };
  const merge = (base, over) => {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (base && typeof base === 'object') {
      const result = { ...base };
      if (over && typeof over === 'object' && !Array.isArray(over)) {
        for (const [key, value] of Object.entries(over)) result[key] = key in base ? merge(base[key], value) : value;
      }
      return result;
    }
    return over === undefined ? base : over;
  };

  async function loadConfig() {
    let remote = window.DEFAULT_CONFIG || {};
    try { remote = merge(remote, await readJson('data/config.json')); }
    catch (error) { state.errors.push(`Konfiguration: ${error.message}`); }
    if (!skipLocalConfig) {
      try {
        const local = localStorage.getItem('24h_twitch_config_override');
        if (local) remote = merge(remote, JSON.parse(local));
      } catch (error) { state.errors.push(`Lokale Konfiguration: ${error.message}`); }
    }
    return remote;
  }

  function applyDesign(config) {
    const d = config.design || {}, root = document.documentElement;
    const map = { accent: '--accent', accent2: '--accent2', background: '--bg', backgroundPanel: '--panel', text: '--text', muted: '--muted', danger: '--danger' };
    Object.entries(map).forEach(([key, css]) => { if (d[key]) root.style.setProperty(css, d[key]); });
    root.style.setProperty('--base', `${Math.max(11, Math.min(20, Number(d.baseFontSize) || 14))}px`);
    root.style.setProperty('--content', `${Math.max(900, Math.min(2400, Number(config.layout?.maxWidth || d.maxPageWidth || 1600)))}px`);
    root.style.setProperty('--glow', `0 0 ${Math.max(0, Math.min(50, Number(d.glowStrength) || 16))}px ${d.accent || '#46e1e7'}29`);
    root.style.setProperty('--border', `${Math.max(.5, Math.min(3, Number(d.borderStrength) || 1))}px`);
    root.style.setProperty('--chat-height', `${Math.max(120, Math.min(900, Number(config.player?.chatHeight) || 260))}px`);
    root.style.setProperty('--heading', `'${String(d.headingFont || 'Orbitron').replace(/[^a-zA-Z0-9 _-]/g, '')}', ${d.headingFallback || 'ui-sans-serif,system-ui,sans-serif'}`);
    root.style.setProperty('--body', `'${String(d.bodyFont || 'Inter').replace(/[^a-zA-Z0-9 _-]/g, '')}', ${d.bodyFallback || 'ui-sans-serif,system-ui,sans-serif'}`);
    const scan = $('.scanlines'); if (scan) scan.style.display = d.scanlines === false ? 'none' : '';
    if (d.animations === false) document.documentElement.classList.add('no-animations');
    const max = Math.max(900, Math.min(2400, Number(config.layout?.maxWidth || 1600)));
    document.querySelector('.page-shell')?.style.setProperty('--content', `${max}px`);
    const layout = config.layout || {}, order = Array.isArray(layout.order) ? layout.order : [];
    const content = $('#page-content');
    const sectionNames = { hero: 'hero', streamers: 'streamers', player: 'player', dashboard: 'dashboard', program: 'program', clips: 'clips', links: 'links' };
    order.forEach((name, index) => {
      const section = $(`[data-section="${name}"]`, content); if (section) section.style.order = String(index);
    });
    for (const [name, opts] of Object.entries(layout.sections || {})) {
      const section = $(`[data-section="${name}"]`, content); if (!section) continue;
      section.hidden = opts.visible === false;
      const width = { full: '1 / -1', '⅔': 'span 4', '2/3': 'span 4', half: 'span 3', '1/2': 'span 3', '⅓': 'span 2', '1/3': 'span 2' }[opts.width || 'full'] || '1 / -1';
      section.style.gridColumn = width;
    }
    if (layout.chatPosition === 'side') {
      $('#stream-players')?.classList.add('chat-side');
      setText('#player-layout-label', 'CHAT: NEBEN DEM STREAM');
      $('#chat-dock')?.setAttribute('hidden', '');
    } else {
      $('#stream-players')?.classList.remove('chat-side');
      setText('#player-layout-label', 'CHAT: UNTER DEN STREAMS');
      $('#chat-dock')?.removeAttribute('hidden');
    }
    document.title = `${config.texts?.heroTitle || '24H Stream'} | ${config.streamers?.map(s => s.displayName).join(' × ') || 'Live-Event'}`;
    for (const [key, value] of Object.entries(config.texts || {})) {
      if (typeof value === 'string') $$(`[data-text="${key}"]`).forEach(node => node.textContent = value);
    }
    if (d.headingFont && d.headingFont !== 'Orbitron') loadGoogleFont(d.headingFont, 'font-heading');
    if (d.bodyFont && d.bodyFont !== 'Inter') loadGoogleFont(d.bodyFont, 'font-body');
  }
  function loadGoogleFont(font, id) {
    const link = document.getElementById(id); if (!link) return;
    const families = encodeURIComponent(font).replace(/%20/g, '+');
    link.href = `https://fonts.googleapis.com/css2?family=${families}:wght@400;500;600;700;800&display=swap`;
  }

  function getStreamers() {
    const configured = state.config.streamers || [];
    return [configured.find(x => x.id === 'a') || configured[0] || { id: 'a', login: 'kevone2107', displayName: 'KevOne2107' },
      configured.find(x => x.id === 'b') || configured[1] || { id: 'b', login: 'sgt_buddie', displayName: 'Sgt_Buddie' }];
  }
  function parentDomain() {
    const host = location.hostname;
    return host && host !== '0.0.0.0' ? host : 'localhost';
  }
  function loadPlayers() {
    const streamers = getStreamers(), parent = encodeURIComponent(parentDomain());
    streamers.forEach((streamer, index) => {
      const id = index === 0 ? 'a' : 'b', login = encodeURIComponent(streamer.login || (id === 'a' ? 'kevone2107' : 'sgt_buddie'));
      const video = $(`#video-${id}`), chat = $(`#chat-${id}`), inline = $(`#inline-chat-${id}`);
      const muted = state.config.player?.muted !== false ? 'true' : 'false';
      if (video) video.src = `https://player.twitch.tv/?channel=${login}&parent=${parent}&autoplay=true&muted=${muted}`;
      const chatUrl = `https://www.twitch.tv/embed/${login}/chat?parent=${parent}&darkpopout`;
      if (chat) chat.src = chatUrl;
      if (inline) inline.innerHTML = `<iframe title="Twitch-Chat ${esc(streamer.displayName)}" loading="lazy" src="${chatUrl}"></iframe>`;
      setText(`#player-name-${id}`, (streamer.displayName || streamer.login).toUpperCase());
      const cardLink = $(`[data-player="${id}"] .player-card-head a`); if (cardLink) cardLink.href = `https://www.twitch.tv/${encodeURIComponent(streamer.login)}`;
      const profileLink = $(`#twitch-link-${id}`); if (profileLink) { profileLink.href = `https://www.twitch.tv/${encodeURIComponent(streamer.login)}`; profileLink.textContent = `@${streamer.login} ↗`; }
      const footerLink = $(`[data-streamer="${id}"] .streamer-footer a`); if (footerLink) footerLink.href = `https://www.twitch.tv/${encodeURIComponent(streamer.login)}`;
    });
    const enabled = state.config.player?.chatEnabled !== false;
    $('#chat-toggle').checked = enabled;
    applyChatState(enabled);
    const wantedView = params.get('view');
    setView(['dual', 'a', 'b'].includes(wantedView) ? wantedView : (state.config.player?.defaultView || 'dual'));
  }
  function applyChatState(enabled) {
    $('#chat-dock')?.classList.toggle('hidden-chat', !enabled);
    $$('.chat-inline').forEach(node => node.style.display = enabled && state.config.layout?.chatPosition === 'side' ? 'block' : 'none');
    $('#chat-dock')?.style.setProperty('display', enabled && state.config.layout?.chatPosition !== 'side' ? 'block' : 'none');
    $('#chat-toggle').checked = enabled;
  }
  function setView(view) {
    state.view = view;
    const grid = $('#stream-players'); if (!grid) return;
    grid.classList.toggle('single', view !== 'dual');
    $$('[data-player]').forEach(node => node.hidden = view !== 'dual' && node.dataset.player !== view);
    $$('[data-chat]').forEach(node => node.hidden = view !== 'dual' && node.dataset.chat !== view);
    $$('.view-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    if (isObs) document.body.classList.add('obs-mode');
  }

  async function requestText(url, timeoutMs = 5500) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { const response = await fetch(url, { cache: 'no-store', signal: controller.signal }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return (await response.text()).trim(); }
    finally { clearTimeout(timer); }
  }
  async function decapiFallback(streamer) {
    const login = encodeURIComponent(streamer.login);
    const endpoints = {
      title: `https://decapi.me/twitch/title/${login}`,
      game: `https://decapi.me/twitch/game/${login}`,
      viewers: `https://decapi.me/twitch/viewercount/${login}`,
      followers: `https://decapi.me/twitch/followcount/${login}`,
      status: `https://decapi.me/twitch/status/${login}`,
      avatar: `https://decapi.me/twitch/avatar/${login}`
    };
    const keys = Object.keys(endpoints), values = await Promise.all(keys.map(async key => {
      try { const value = await requestText(endpoints[key]); return [key, value]; } catch { return [key, null]; }
    }));
    const result = Object.fromEntries(values);
    const clean = value => value && !/unknown|not found|error|invalid|offline|no data|something went wrong|could not find/i.test(value) ? value : null;
    const statusText = (result.status || '').toLowerCase();
    const isLive = /online|live|is streaming|streaming/i.test(statusText) ? true : /offline|not streaming/i.test(statusText) ? false : null;
    return {
      isLive, title: clean(result.title), game: clean(result.game),
      viewers: clean(result.viewers) && /^\d+$/.test(result.viewers) ? Number(result.viewers) : null,
      followers: clean(result.followers) && /^\d+$/.test(result.followers) ? Number(result.followers) : null,
      avatar: validUrl(result.avatar || '')
    };
  }
  async function loadDataFiles() {
    try { state.stats = await readJson('data/stats.json'); } catch (error) { state.errors.push(`Statistik: ${error.message}`); state.stats = { channels: {} }; }
    try { state.history = await readJson('data/history.json'); } catch { state.history = { samples: [] }; }
    try { const file = await readJson('data/clips.json'); state.clips = Array.isArray(file.clips) ? file.clips : []; } catch { state.clips = []; }
  }
  async function refreshFallback() {
    if (state.config.data?.liveFallback === false) return;
    const streamers = getStreamers();
    const snapshots = await Promise.all(streamers.map(decapiFallback));
    streamers.forEach((streamer, i) => {
      const old = state.stats.channels?.[streamer.login] || {};
      const fresh = snapshots[i];
      if (!state.stats.channels) state.stats.channels = {};
      const merged = { ...old };
      for (const key of ['isLive', 'title', 'game', 'viewers', 'followers', 'avatar']) {
        if (fresh[key] !== null && fresh[key] !== undefined && fresh[key] !== '') merged[key] = fresh[key];
      }
      if (fresh.isLive !== null) merged.isLive = fresh.isLive;
      state.stats.channels[streamer.login] = merged;
    });
    const successful = snapshots.some(x => Object.values(x).some(v => v !== null && v !== ''));
    if (successful) state.dataSource = 'Twitch Helix / DecAPI.me (Browser-Fallback)';
  }

  function renderStreamers() {
    const streamers = getStreamers();
    streamers.forEach((streamer, index) => {
      const id = index === 0 ? 'a' : 'b', data = state.stats.channels?.[streamer.login] || {};
      setText(`#name-${id}`, safe(streamer.displayName, streamer.login));
      setText(`#bio-${id}`, safe(streamer.bio, 'N/A'));
      const initials = (streamer.displayName || streamer.login || '?').split(/\s|_/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
      const initialNode = $(`#initials-${id}`); if (initialNode) initialNode.textContent = initials || '?';
      const img = $(`#avatar-${id}`), avatar = safe(data.avatar || streamer.profileImageUrl, '');
      if (avatar && validUrl(avatar)) { img.src = validUrl(avatar); img.hidden = false; img.onerror = () => { img.hidden = true; }; } else img.hidden = true;
      const live = data.isLive === true;
      const pill = $(`[data-live="${id}"]`); if (pill) { pill.classList.toggle('live', live); pill.innerHTML = `<i></i> ${live ? 'LIVE' : data.isLive === false ? 'OFFLINE' : 'STATUS N/A'}`; }
      setText(`#followers-${id}`, fmt(data.followers)); setText(`#viewers-${id}`, data.isLive === true ? fmt(data.viewers) : (data.isLive === false ? '0' : fmt(data.viewers)));
      setText(`#game-${id}`, safe(data.game)); setText(`#title-${id}`, safe(data.title, data.isLive === false ? 'Aktuell keine Live-Übertragung.' : 'Streamtitel nicht verfügbar.'));
      setText(`#updated-${id}`, data.source ? `QUELLE: ${data.source}` : `DATEN: ${data.isLive === null || data.isLive === undefined ? 'N/A' : 'AKTUELL'}`);
      const led = $(`#player-led-${id}`); if (led) led.classList.toggle('online', live);
      const placeholder = $(`#placeholder-${id}`); if (placeholder) placeholder.style.display = data.isLive === false ? '' : 'none';
    });
  }

  function renderDashboard() {
    const streams = getStreamers(), a = state.stats.channels?.[streams[0].login] || {}, b = state.stats.channels?.[streams[1].login] || {};
    const av = a.isLive === true && Number.isFinite(Number(a.viewers)) ? Number(a.viewers) : (a.isLive === false ? 0 : null);
    const bv = b.isLive === true && Number.isFinite(Number(b.viewers)) ? Number(b.viewers) : (b.isLive === false ? 0 : null);
    const total = av === null && bv === null ? null : (av || 0) + (bv || 0);
    setText('#combined-viewers', fmt(total)); setText('#dash-viewers-a', fmt(av)); setText('#dash-viewers-b', fmt(bv));
    const max = Math.max(1, av || 0, bv || 0);
    $('#view-bar-a').style.width = `${((av || 0) / max) * 100}%`; $('#view-bar-b').style.width = `${((bv || 0) / max) * 100}%`;
    const af = Number.isFinite(Number(a.followers)) ? Number(a.followers) : null, bf = Number.isFinite(Number(b.followers)) ? Number(b.followers) : null;
    const avgA = Number.isFinite(Number(a.averageViewers30d)) ? Number(a.averageViewers30d) : null, avgB = Number.isFinite(Number(b.averageViewers30d)) ? Number(b.averageViewers30d) : null;
    setText('#compare-a-followers', fmt(af)); setText('#compare-b-followers', fmt(bf)); setText('#compare-a-avg', fmt(avgA)); setText('#compare-b-avg', fmt(avgB));
    const maxFollowers = Math.max(1, af || 0, bf || 0), maxAvg = Math.max(1, avgA || 0, avgB || 0);
    $('#compare-bar-a').style.width = `${(af || 0) / maxFollowers * 100}%`; $('#compare-bar-a').style.gridColumn = '1/-1';
    $('#compare-bar-avg-a').style.width = `${(avgA || 0) / maxAvg * 100}%`; $('#compare-bar-avg-a').style.gridColumn = '1/-1';
    const milestoneRoot = $('#follower-milestones'), marks = state.config.data?.followerMilestones || [];
    milestoneRoot.innerHTML = '';
    const entries = streams.map((streamer, i) => ({ streamer, data: i ? b : a }));
    entries.forEach(({ streamer, data }) => marks.forEach(mark => {
      const done = Number.isFinite(Number(data.followers)) && Number(data.followers) >= Number(mark);
      const node = document.createElement('div'); node.className = `milestone-item ${done ? 'done' : ''}`;
      node.innerHTML = `<i></i><span>${esc(streamer.displayName)}<b>${fmt(mark)} Follower${done ? ' · erreicht' : ''}</b></span>`; milestoneRoot.append(node);
    }));
    if (!milestoneRoot.children.length) milestoneRoot.innerHTML = '<p class="empty-note">Keine Follower-Meilensteine konfiguriert.</p>';
    renderChart(streams);
    renderTrackingRows(streams, a, b);
    const updated = state.stats.updatedAt || null;
    setText('#source-summary', safe(state.stats.source, state.dataSource));
    setText('#source-timestamp', `LETZTES UPDATE: ${timeFmt(updated)}`);
    setText('#last-updated', `DATENSTAND: ${timeFmt(updated)}`);
    setText('#reactor-source', `QUELLE: ${state.dataSource.toUpperCase().slice(0, 32)}`);
  }

  function renderTrackingRows(streamers, a, b) {
    const panel = $('#tracking-panel'), root = $('#tracking-rows');
    if (state.config.data?.twitchTrackerRows === false) { panel.hidden = true; return; }
    panel.hidden = false; root.innerHTML = '';
    [a, b].forEach((data, index) => {
      const streamer = streamers[index];
      const tracker = state.stats.tracker?.[streamer.login] || {};
      const row = document.createElement('article'); row.className = 'tracking-channel';
      const values = [
        ['Ø ZUSCHAUER', data.averageViewers30d], ['PEAK-ZUSCHAUER', data.peakViewers30d],
        ['LIVE-STUNDEN', data.hoursLive30d], ['ZUSCHAUERSTUNDEN', data.viewerHours30d],
        ['FOLLOWER-ZUWACHS', data.followerChange30d], ['RANG', data.rank30d]
      ];
      row.innerHTML = `<h3>${esc(streamer.displayName)}</h3><div class="tracking-stats">${values.map(([label, value]) => `<div><span>${esc(label)}</span><b>${esc(safe(value))}</b></div>`).join('')}</div><div class="tracking-source">STATISTIK-SNAPSHOT: ${esc(data.snapshotPeriod || 'N/A')} · TWITCHTRACKER: ${esc(tracker.status || 'N/A')}</div>`;
      root.append(row);
    });
  }

  function renderChart(streamers) {
    const svg = $('#follower-chart'), samples = Array.isArray(state.history.samples) ? state.history.samples : [];
    const validSamples = samples.filter(sample => sample.channels && ([sample.channels[streamers[0].login]?.followers, sample.channels[streamers[1].login]?.followers].some(v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)))));
    if (validSamples.length < 2) {
      svg.innerHTML = '<text x="320" y="96" text-anchor="middle" class="chart-empty">Verlaufsdaten werden mit den nächsten Updates aufgebaut</text>';
      setText('#chart-range', 'VERLAUF: NOCH NICHT VERFÜGBAR'); setText('#chart-source', 'DATENQUELLE: GITHUB-ACTIONS'); return;
    }
    const w = 640, h = 190, left = 20, right = 12, top = 12, bottom = 20;
    const all = validSamples.flatMap(sample => [sample.channels[streamers[0].login]?.followers, sample.channels[streamers[1].login]?.followers].filter(v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))).map(Number));
    const min = Math.min(...all), max = Math.max(...all), span = Math.max(1, max - min);
    const path = login => validSamples.map((sample, i) => {
      const value = sample.channels[login]?.followers;
      if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return null;
      const x = left + i * (w - left - right) / (validSamples.length - 1);
      const y = h - bottom - (Number(value) - min) / span * (h - top - bottom);
      return `${i === 0 || !validSamples.slice(0, i).some(s => (s.channels[login]?.followers !== null && s.channels[login]?.followers !== undefined && s.channels[login]?.followers !== '' && Number.isFinite(Number(s.channels[login]?.followers)))) ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).filter(Boolean).join(' ');
    const grid = [0, 1, 2, 3].map(i => `<line class="chart-grid-line" x1="${left}" x2="${w-right}" y1="${top+i*(h-top-bottom)/3}" y2="${top+i*(h-top-bottom)/3}"/>`).join('');
    svg.innerHTML = `${grid}<path class="chart-line-a" d="${path(streamers[0].login)}"/><path class="chart-line-b" d="${path(streamers[1].login)}"/>`;
    setText('#chart-range', `VERLAUF: ${validSamples.length} MESSPUNKTE`); setText('#chart-source', 'DATENQUELLE: GITHUB-ACTIONS / HELIX');
  }

  function renderProgram() {
    const lists = state.config.lists || {};
    const schedule = $('#schedule-list'); schedule.innerHTML = '';
    (lists.schedule || []).forEach(item => {
      const row = document.createElement('div'); row.className = 'schedule-item';
      row.innerHTML = `<time class="schedule-time">${esc(item.time || 'N/A')}</time><i class="schedule-pin"></i><div><strong>${esc(item.title || 'Programmpunkt')}</strong><p>${esc(item.description || '')}</p></div>`; schedule.append(row);
    });
    if (!schedule.children.length) schedule.innerHTML = `<p class="empty-note">${esc(state.config.texts?.labels?.noSchedule || 'Noch keine Programmpunkte hinterlegt.')}</p>`;
    const games = $('#games-list'); games.innerHTML = '';
    (lists.games || []).forEach(game => { const node = document.createElement('span'); node.className = 'game-tag'; node.textContent = typeof game === 'string' ? game : game.name || 'N/A'; games.append(node); });
    if (!games.children.length) games.innerHTML = '<span class="empty-note">N/A – noch keine Spiele bestätigt</span>';
    const challenges = $('#challenge-list'); challenges.innerHTML = '';
    (lists.challenges || []).forEach((challenge, i) => { const node = document.createElement('div'); node.className = 'challenge-item'; node.innerHTML = `<i>${String(i+1).padStart(2,'0')}</i><span>${esc(typeof challenge === 'string' ? challenge : challenge.title || '')}</span>`; challenges.append(node); });
    if (!challenges.children.length) challenges.innerHTML = '<p class="empty-note">Noch keine Challenges bestätigt.</p>';
    renderEventMilestones();
  }
  function renderEventMilestones() {
    const root = $('#event-milestones'); root.innerHTML = '';
    const start = eventStart(), duration = Number(state.config.event?.durationHours) || 24, marks = state.config.event?.milestonesHours || [];
    marks.forEach(hour => {
      const row = document.createElement('div'); row.className = 'event-point';
      const when = start ? new Date(start.getTime() + Number(hour) * 3600000) : null;
      row.innerHTML = `<time>${Number(hour)}H</time><div>${Number(hour) === duration ? 'Event-Abschluss' : `Meilenstein nach ${Number(hour)} Stunde${Number(hour) === 1 ? '' : 'n'}`}<small>${when ? timeFmt(when) : 'Startzeit noch nicht festgelegt'}</small></div>`; root.append(row);
    });
    if (!root.children.length) root.innerHTML = '<p class="empty-note">Keine Event-Meilensteine konfiguriert.</p>';
  }
  function renderClips() {
    const local = (() => { try { return JSON.parse(localStorage.getItem('24h_twitch_manual_clips') || '[]'); } catch { return []; } })();
    const clips = [...(state.config.lists?.clips || []), ...state.clips, ...local];
    const unique = [...new Map(clips.filter(x => validUrl(x.url)).map(x => [x.url, x])).values()].slice(0, 18);
    const root = $('#clips-grid'); root.innerHTML = '';
    unique.forEach(clip => {
      const card = document.createElement('article'); card.className = 'clip-card';
      const thumbnail = validUrl(clip.thumbnail_url || clip.thumbnail || '');
      card.innerHTML = `<div class="clip-thumb">${thumbnail ? `<img loading="lazy" src="${thumbnail}" alt="Clip-Vorschaubild">` : ''}<span>${esc(clip.creator_name || clip.streamer || 'HIGHLIGHT')}</span></div><div class="clip-info"><strong>${esc(clip.title || clip.name || 'Twitch-Highlight')}</strong><div class="clip-meta"><span>${esc(clip.view_count != null ? `${fmt(clip.view_count)} Aufrufe` : (clip.created_at ? timeFmt(clip.created_at) : 'MANUELL'))}</span><span>${esc(clip.game_name || '')}</span></div><a href="${validUrl(clip.url)}" target="_blank" rel="noopener">CLIP ANSEHEN ↗</a></div>`;
      root.append(card);
    });
    if (!root.children.length) root.innerHTML = `<p class="empty-note">${esc(state.config.texts?.labels?.noClips || 'Noch keine Clips verfügbar.')}</p>`;
  }
  function renderLinks() {
    const root = $('#community-links'); root.innerHTML = '';
    const links = [];
    getStreamers().forEach(streamer => (streamer.links || []).forEach(link => links.push({ ...link, owner: streamer.displayName })));
    (state.config.lists?.social || []).forEach(link => links.push(link));
    (state.config.lists?.links || []).forEach(link => links.push(link));
    links.forEach((link, i) => {
      const url = validUrl(link.url); if (!url) return;
      const anchor = document.createElement('a'); anchor.className = 'community-link'; anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener';
      const symbol = (link.type || link.label || '↗').toString().slice(0, 1).toUpperCase();
      anchor.innerHTML = `<span class="community-icon">${esc(symbol)}</span><span><strong>${esc(link.label || 'Link')}</strong><small>${esc(link.description || link.owner || link.type || 'EXTERNER LINK')}</small></span>`; root.append(anchor);
    });
    if (!root.children.length) root.innerHTML = `<p class="empty-note">${esc(state.config.texts?.labels?.noLinks || 'Keine verifizierten Links hinterlegt.')}</p>`;
    const sources = $('#source-register-list'); sources.innerHTML = '';
    (state.config.sources || []).forEach(source => {
      const url = validUrl(source.url); if (!url) return;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.title = source.note || ''; a.textContent = source.label || 'Quelle'; sources.append(a);
    });
  }

  function eventStart() {
    const raw = params.get('start') || state.config.event?.startAt;
    if (!raw) return null;
    const date = new Date(raw); return Number.isNaN(date.getTime()) ? null : date;
  }
  function updateEvent() {
    const start = eventStart(), duration = Math.max(1, Number(state.config.event?.durationHours) || 24), now = new Date();
    const countdown = $('#countdown'), label = $('#countdown-label'), phase = $('#event-phase-label'), message = $('#system-message');
    const progress = $('#event-progress-bar'), progressVal = $('#event-progress-value');
    const labels = state.config.texts?.labels || {};
    if (!start) {
      label.textContent = labels.countdown || 'COUNTDOWN BIS STREAMSTART';
      countdown.innerHTML = '<div><strong>--</strong><small>TAGE</small></div><b>:</b><div><strong>--</strong><small>STD</small></div><b>:</b><div><strong>--</strong><small>MIN</small></div><b>:</b><div><strong>--</strong><small>SEK</small></div>';
      phase.textContent = 'STARTZEIT NICHT FESTGELEGT'; progress.style.width = '0%'; progressVal.textContent = '0 %';
      setText('#event-start-label', 'START: N/A'); setText('#event-end-label', `DAUER: ${duration} STD`);
      message.textContent = 'EVENT-STARTZEIT FEHLT – KONFIGURATION PRÜFEN'; return;
    }
    const end = new Date(start.getTime() + duration * 3600000), remaining = start - now, elapsed = now - start;
    setText('#event-start-label', `START: ${timeFmt(start)}`); setText('#event-end-label', `ENDE: ${timeFmt(end)}`);
    if (remaining > 0) {
      const seconds = Math.floor(remaining / 1000), days = Math.floor(seconds / 86400), hours = Math.floor((seconds % 86400) / 3600), mins = Math.floor((seconds % 3600) / 60), secs = seconds % 60;
      label.textContent = labels.countdown || 'COUNTDOWN BIS STREAMSTART';
      countdown.innerHTML = `<div><strong>${String(days).padStart(2,'0')}</strong><small>TAGE</small></div><b>:</b><div><strong>${String(hours).padStart(2,'0')}</strong><small>STD</small></div><b>:</b><div><strong>${String(mins).padStart(2,'0')}</strong><small>MIN</small></div><b>:</b><div><strong>${String(secs).padStart(2,'0')}</strong><small>SEK</small></div>`;
      phase.textContent = 'EVENT STARTET BALD'; progress.style.width = '0%'; progressVal.textContent = '0 %'; message.textContent = `COUNTDOWN AKTIV – START ${timeFmt(start)}`;
    } else if (elapsed < duration * 3600000) {
      const elapsedSeconds = Math.floor(elapsed / 1000), h = Math.floor(elapsedSeconds / 3600), m = Math.floor((elapsedSeconds % 3600) / 60), s = elapsedSeconds % 60;
      label.textContent = labels.running || 'EVENT LÄUFT – LAUFZEIT';
      countdown.innerHTML = `<div><strong>${String(h).padStart(2,'0')}</strong><small>STD</small></div><b>:</b><div><strong>${String(m).padStart(2,'0')}</strong><small>MIN</small></div><b>:</b><div><strong>${String(s).padStart(2,'0')}</strong><small>SEK</small></div>`;
      const percent = Math.min(100, elapsed / (duration * 3600000) * 100);
      phase.textContent = `EVENT LÄUFT · STUNDE ${h}`; progress.style.width = `${percent}%`; progressVal.textContent = `${percent.toFixed(1).replace('.', ',')} %`;
      message.textContent = `EVENTPHASE AKTIV – ${h}H ${m}M SEIT START`;
    } else {
      label.textContent = labels.finished || 'EVENT ABGESCHLOSSEN';
      countdown.innerHTML = `<div><strong>${duration}</strong><small>STD</small></div><b>:</b><div><strong>00</strong><small>MIN</small></div><b>:</b><div><strong>00</strong><small>SEK</small></div>`;
      phase.textContent = 'EVENT ABGESCHLOSSEN'; progress.style.width = '100%'; progressVal.textContent = '100 %'; message.textContent = 'EVENT ABGESCHLOSSEN – DATENARCHIV AKTIV';
    }
  }

  function updateSystemStatus() {
    const channels = Object.values(state.stats.channels || {}), known = channels.filter(c => typeof c.isLive === 'boolean'), anyLive = channels.some(c => c.isLive === true);
    const dot = $('#global-status-dot');
    if (state.errors.length) { dot.className = 'status-dot error'; setText('#global-status', 'DATENQUELLE MIT HINWEIS'); setText('#footer-status', 'DATENSTATUS: TEILWEISE'); }
    else if (anyLive) { dot.className = 'status-dot online'; setText('#global-status', 'LIVE-VERBINDUNG AKTIV'); setText('#footer-status', 'DATENSTATUS: LIVE'); }
    else if (known.length === channels.length && known.length) { dot.className = 'status-dot'; setText('#global-status', 'KANÄLE OFFLINE'); setText('#footer-status', 'DATENSTATUS: OFFLINE'); }
    else { dot.className = 'status-dot'; setText('#global-status', 'SYSTEM BEREIT · STATUS N/A'); setText('#footer-status', 'DATENSTATUS: N/A'); }
    const message = state.errors.length ? `SYSTEMHINWEIS: ${state.errors[0]}` : anyLive ? 'LIVE-SIGNAL ERKANNT – DATENSTROM AKTIV' : 'SYSTEM ONLINE – WARTE AUF LIVE-SIGNAL';
    const system = $('#system-message'); if (system && !/COUNTDOWN|EVENTPHASE|EVENT-STARTZEIT FEHLT|EVENT ABGESCHLOSSEN/.test(system.textContent)) system.textContent = message;
  }
  function setupObs() {
    if (!isObs) return;
    document.body.classList.add('obs-mode');
    const widget = params.get('widget') || 'player';
    const sectionMap = { hero: 'hero', streamers: 'streamers', player: 'player', dashboard: 'dashboard', program: 'program', clips: 'clips', links: 'links', status: 'hero', countdown: 'hero', 'streamer-cards': 'streamers' };
    const target = sectionMap[widget] || 'player';
    if (target === 'hero') document.body.classList.add('obs-hero-mode');
    $$('.section[data-section]').forEach(section => { section.hidden = section.dataset.section !== target; });
    if (widget === 'hero') { $('.hero-copy')?.setAttribute('hidden', ''); }
    if (target !== 'player') $('#page-content').style.padding = '0';
    document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
  }

  async function refreshAll() {
    state.errors = [];
    await loadDataFiles();
    const previous = state.dataSource;
    state.dataSource = state.stats.source?.includes('TwitchMetrics') ? 'TwitchMetrics-Snapshot' : 'Twitch Helix API';
    await refreshFallback();
    if (previous !== state.dataSource && previous !== 'Wird initialisiert') state.systemChanges = (state.systemChanges || 0) + 1;
    renderStreamers(); renderDashboard(); renderClips(); updateSystemStatus();
  }
  async function init() {
    state.config = await loadConfig(); applyDesign(state.config); loadPlayers();
    renderProgram(); renderLinks(); setupObs();
    $('#chat-toggle')?.addEventListener('change', event => applyChatState(event.target.checked));
    $$('.view-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
    $('#add-clip')?.addEventListener('click', addManualClip);
    await refreshAll(); updateEvent();
    state.eventTimer = setInterval(updateEvent, 1000);
    const refreshMs = Math.max(60, Number(state.config.data?.refreshSeconds) || 900) * 1000;
    state.pollTimer = setInterval(refreshAll, refreshMs);
  }
  function addManualClip() {
    const url = prompt('Twitch-Clip-URL eingeben:'); if (!url) return;
    const safeUrlValue = validUrl(url.trim());
    if (!safeUrlValue || !/twitch\.tv|clips\.twitch\.tv/i.test(new URL(safeUrlValue).hostname)) { toast('Bitte eine gültige Twitch-Clip-URL eingeben.', 'error'); return; }
    const title = prompt('Titel für das Highlight (optional):') || 'Manuell hinzugefügter Twitch-Clip';
    try {
      const items = JSON.parse(localStorage.getItem('24h_twitch_manual_clips') || '[]');
      items.unshift({ url: safeUrlValue, title: title.trim(), created_at: new Date().toISOString(), creator_name: 'MANUELL' });
      localStorage.setItem('24h_twitch_manual_clips', JSON.stringify(items.slice(0, 30)));
      renderClips(); toast('Clip wurde lokal ergänzt.');
    } catch (error) { toast(`Lokales Speichern blockiert: ${error.message}`, 'error'); }
  }
  init().catch(error => { console.error(error); toast(`Website konnte nicht vollständig initialisiert werden: ${error.message}`, 'error'); setText('#global-status', 'INITIALISIERUNGSFEHLER'); });
})();
