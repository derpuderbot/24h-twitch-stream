import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../../', import.meta.url);
const CONFIG_PATH = new URL('data/config.json', ROOT);
const STATS_PATH = new URL('data/stats.json', ROOT);
const HISTORY_PATH = new URL('data/history.json', ROOT);
const CLIPS_PATH = new URL('data/clips.json', ROOT);
const now = new Date();
const isoNow = now.toISOString();
const log = (...args) => console.log('[twitch-sync]', ...args);

async function readJson(url, fallback) {
  try { return JSON.parse(await readFile(url, 'utf8')); }
  catch { return fallback; }
}
async function writeJson(url, value) {
  await writeFile(url, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
  const raw = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw.slice(0, 220)}`);
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw new Error('Antwort ist kein gültiges JSON.'); }
}
async function helix(path, accessToken, clientId) {
  return fetchJson(`https://api.twitch.tv/helix/${path}`, { headers: { 'Client-Id': clientId, Authorization: `Bearer ${accessToken}` } });
}
async function appToken(clientId, clientSecret) {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' });
  const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Twitch OAuth HTTP ${response.status}: ${raw.slice(0, 220)}`);
  const parsed = JSON.parse(raw);
  if (!parsed.access_token) throw new Error('OAuth-Antwort enthält kein access_token.');
  return parsed.access_token;
}
async function trackerSummary(login) {
  const url = `https://twitchtracker.com/api/channels/summary/${encodeURIComponent(login)}`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': '24h-twitch-pages-monitor/1.0' } });
    if (!response.ok) return { status: `HTTP ${response.status}`, data: null, checkedAt: isoNow, source: url };
    const text = await response.text();
    try { return { status: 'OK', data: JSON.parse(text), checkedAt: isoNow, source: url }; }
    catch { return { status: 'Antwort nicht als JSON lesbar', data: null, checkedAt: isoNow, source: url }; }
  } catch (error) {
    return { status: `Fehler: ${error.message}`, data: null, checkedAt: isoNow, source: url };
  }
}
async function fetchFollowerTotal(userId, userToken, clientId) {
  if (!userToken) return { total: null, status: 'Kein kanalbezogener User-Token hinterlegt' };
  try {
    const result = await helix(`channels/followers?broadcaster_id=${encodeURIComponent(userId)}&first=1`, userToken, clientId);
    return { total: Number.isFinite(Number(result.total)) ? Number(result.total) : null, status: 'Twitch Helix – User-Token' };
  } catch (error) {
    return { total: null, status: `Follower-Endpunkt nicht verfügbar: ${error.message}` };
  }
}
async function fetchChannel(streamer, token, clientId, priorStats) {
  const users = await helix(`users?login=${encodeURIComponent(streamer.login)}`, token, clientId);
  const user = users.data?.[0];
  if (!user) throw new Error(`Twitch-Kanal ${streamer.login} wurde von Helix nicht gefunden.`);
  const [streamsResult, channelsResult, clipsResult, followerResult] = await Promise.allSettled([
    helix(`streams?user_id=${encodeURIComponent(user.id)}`, token, clientId),
    helix(`channels?broadcaster_id=${encodeURIComponent(user.id)}`, token, clientId),
    helix(`clips?broadcaster_id=${encodeURIComponent(user.id)}&first=20`, token, clientId),
    fetchFollowerTotal(user.id, process.env[`TWITCH_USER_TOKEN_${streamer.login.toUpperCase()}`], clientId)
  ]);
  const stream = streamsResult.status === 'fulfilled' ? streamsResult.value.data?.[0] || null : null;
  const channel = channelsResult.status === 'fulfilled' ? channelsResult.value.data?.[0] || {} : {};
  const clips = clipsResult.status === 'fulfilled' ? (clipsResult.value.data || []) : [];
  const follower = followerResult.status === 'fulfilled' ? followerResult.value : { total: null, status: 'Fehler beim Follower-Abruf' };
  const previous = priorStats.channels?.[streamer.login] || {};
  const live = Boolean(stream);
  const result = {
    login: streamer.login,
    displayName: user.display_name || streamer.displayName || streamer.login,
    userId: user.id,
    isLive: live,
    title: live ? (stream.title || 'N/A') : 'N/A',
    game: live ? (stream.game_name || 'N/A') : (channel.game_name || previous.game || 'N/A'),
    viewers: live ? Number(stream.viewer_count || 0) : 0,
    followers: follower.total ?? previous.followers ?? null,
    followersSource: follower.total !== null ? follower.status : (previous.followersSource || follower.status),
    avatar: user.profile_image_url || streamer.profileImageUrl || '',
    bio: user.description || streamer.bio || 'N/A',
    language: live ? (stream.language || 'N/A') : (user.broadcaster_type || 'N/A'),
    streamStartedAt: live ? stream.started_at || null : null,
    averageViewers30d: previous.averageViewers30d ?? null,
    peakViewers30d: previous.peakViewers30d ?? null,
    viewerHours30d: previous.viewerHours30d ?? null,
    hoursLive30d: previous.hoursLive30d ?? null,
    followerChange30d: previous.followerChange30d ?? null,
    rank30d: previous.rank30d ?? 'N/A',
    firstSeen: previous.firstSeen || null,
    updatedAt: isoNow,
    source: 'Twitch Helix API'
  };
  return { result, clips: clips.map(clip => ({
    id: clip.id, url: clip.url, embed_url: clip.embed_url, title: clip.title,
    creator_name: clip.creator_name, broadcaster_name: clip.broadcaster_name,
    game_name: clip.game_name || '', view_count: clip.view_count,
    created_at: clip.created_at, thumbnail_url: clip.thumbnail_url,
    duration: clip.duration, language: clip.language, streamer: streamer.displayName || streamer.login
  })) };
}

async function main() {
  const config = await readJson(CONFIG_PATH, {});
  const priorStats = await readJson(STATS_PATH, { channels: {}, tracker: {} });
  const history = await readJson(HISTORY_PATH, { samples: [] });
  const oldClips = await readJson(CLIPS_PATH, { clips: [] });
  const streamers = Array.isArray(config.streamers) ? config.streamers.slice(0, 2) : [];
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  let token = null;

  const stats = { ...priorStats, channels: { ...(priorStats.channels || {}) }, tracker: { ...(priorStats.tracker || {}) }, updatedAt: priorStats.updatedAt || null };
  let allClips = [];
  if (!clientId || !clientSecret) {
    log('TWITCH_CLIENT_ID oder TWITCH_CLIENT_SECRET fehlt. Vorhandene Werte bleiben unverändert; Browser-Fallback bleibt aktiv.');
    stats.source = 'Keine GitHub-Secrets konfiguriert – Browser-Fallback (DecAPI.me)';
  } else {
    try { token = await appToken(clientId, clientSecret); }
    catch (error) { log('OAuth fehlgeschlagen:', error.message); stats.error = error.message; }
  }

  if (token) {
    const results = await Promise.all(streamers.map(async streamer => {
      try {
        const { result, clips } = await fetchChannel(streamer, token, clientId, stats);
        stats.channels[streamer.login] = result;
        allClips = allClips.concat(clips);
        log(`${streamer.login}: ${result.isLive ? 'LIVE' : 'OFFLINE'}, Follower=${result.followers ?? 'N/A'}`);
      } catch (error) {
        log(`${streamer.login}: Helix-Fehler:`, error.message);
        stats.channels[streamer.login] = { ...(stats.channels[streamer.login] || {}), login: streamer.login, error: error.message, updatedAt: isoNow };
      }
    }));
    await Promise.all(streamers.map(async streamer => {
      if (config.data?.twitchTrackerRows === false) {
        stats.tracker[streamer.login] = { status: 'In Konfiguration deaktiviert', data: null, checkedAt: isoNow };
        return;
      }
      stats.tracker[streamer.login] = await trackerSummary(streamer.login);
      log(`TwitchTracker ${streamer.login}: ${stats.tracker[streamer.login].status}`);
    }));
    stats.updatedAt = isoNow;
    stats.source = 'Twitch Helix API (GitHub Actions)';
    delete stats.error;
  }

  const snapshotChannels = {};
  for (const streamer of streamers) {
    const channel = stats.channels?.[streamer.login] || {};
    snapshotChannels[streamer.login] = {
      followers: channel.followers ?? null,
      viewers: channel.isLive === true ? channel.viewers ?? null : (channel.isLive === false ? 0 : null),
      isLive: typeof channel.isLive === 'boolean' ? channel.isLive : null
    };
  }
  const bucket = Math.floor(now.getTime() / (15 * 60 * 1000));
  const samples = Array.isArray(history.samples) ? history.samples : [];
  const hasFreshHelixSample = Boolean(token) && streamers.some(streamer => stats.channels?.[streamer.login]?.updatedAt === isoNow);
  if (hasFreshHelixSample) {
    if (!samples.length || samples[samples.length - 1].bucket !== bucket) {
      samples.push({ bucket, timestamp: isoNow, channels: snapshotChannels });
    } else {
      samples[samples.length - 1] = { ...samples[samples.length - 1], timestamp: isoNow, channels: snapshotChannels };
    }
  } else {
    log('Kein frischer Helix-Snapshot – Verlauf wird nicht mit alten Werten fortgeschrieben.');
  }
  const retentionDays = Math.max(1, Math.min(365, Number(config.data?.historyDays) || 90));
  const cut = now.getTime() - retentionDays * 86400000;
  const retained = samples.filter(item => Date.parse(item.timestamp) >= cut).slice(-Math.ceil(retentionDays * 24 * 4));
  const newHistory = { updatedAt: hasFreshHelixSample ? isoNow : (history.updatedAt || null), samples: retained };

  const manualClips = (Array.isArray(config.lists?.clips) ? config.lists.clips : []).filter(x => x?.url);
  const mergedClips = [...allClips, ...(Array.isArray(oldClips.clips) ? oldClips.clips : []), ...manualClips];
  const uniqueClips = [...new Map(mergedClips.filter(x => x?.url).map(x => [x.url, x])).values()]
    .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0)).slice(0, 120);

  await writeJson(STATS_PATH, stats);
  await writeJson(HISTORY_PATH, newHistory);
  const sameClips = JSON.stringify(uniqueClips) === JSON.stringify(Array.isArray(oldClips.clips) ? oldClips.clips : []);
  await writeJson(CLIPS_PATH, { updatedAt: sameClips ? (oldClips.updatedAt || null) : isoNow, clips: uniqueClips });
  log(`Daten geschrieben. Samples=${retained.length}, Clips=${uniqueClips.length}`);
}

main().catch(error => { console.error('[twitch-sync] Fatal:', error); process.exitCode = 1; });
