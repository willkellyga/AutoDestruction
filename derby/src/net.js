// Playing online (derby/server: the lobby and the relay). Two halves:
//
// The lobby. Quick play is one tap (quickPlay): a mode's card on the home screen (Online), or Play again on the results,
// asks the relay for a quick room for that mode, and the relay answers `go` at once, for a round that is counting down
// (derby/server/relay.mjs). The page loads again on its map as ?map=<mode>&mp=<round>&h=<host>&quick=1 (the world is laid
// out once, as the page loads), so the countdown runs while the map loads, and nobody waits on a menu. The lobby panel
// on the start card (makeLobby) is for friends: a room with a four-letter code; whoever made it picks the mode and starts.
//
// The round. Each device drives its own car and sends where it is about 15 times a second, with its aim, its triggers
// and its armour; the host's device also drives the bots (and, on the base, the horde) and sends theirs. Everyone else's
// car is a puppet here (`remote`), moved to where its owner says it is. Every device fires every car's guns, so the
// rounds, rockets, mines, oil and flames fly everywhere; but a car only takes damage on its owner's device (main.js
// damage() skips a puppet), from what hit it there. When a car's armour runs out its owner says so, and every device
// wrecks its puppet, with the kill put down to whoever its owner says did it. Pickups go to whoever's own device sees
// their car take one. The modes keep their own score from these, the same on every device. The hazards and the show
// run on each device from the clock, which starts for everyone at the relay's `begin`.
// When the host leaves, the next player in hosts: their device takes over the bots (and the horde) where they stand.
// A device that drops out keeps its seat (Monster Mayhem's playtests: iPad pages die for memory and reload): the relay
// holds the round and the host's bots for a while, and a page that comes back fresh gets its scores back (mode.netSave
// and netLoad) and, if it hosts alone, the bots as they were (`b`, re-seeded here). A page in the background says it is
// away, so a host's bots move on. In the first 30 s of an arena or survival round a new player takes over a bot (`seat`):
// every device takes that bot out, and the new player's own car starts where it was.
//
// Without ?mp= in the address none of the round half runs, and the game is as it was.
import { leavePage } from './leave.js';
const Q = new URLSearchParams(location.search);
export const ROUND = (Q.get('mp') || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
const HOST0 = Q.get('h') || '';
const ROOM = (Q.get('r') || '').replace(/[^A-Z]/gi, '').slice(0, 4).toUpperCase(), QUICK = Q.get('quick') === '1';
const MODES = ['arena', 'race', 'base'];
// a map that is one of a mode's maps goes by that mode (the relay's POOLS: the round's map is picked at random)
const POOL_MODE = { fair: 'base', empire: 'race', capital: 'race', tokyo: 'race' };
const modeKey = (id) => POOL_MODE[id] || id;
const MODE_NAME = { arena: 'Arena', race: 'Race', empire: 'Race', capital: 'Race', tokyo: 'Race', base: 'Zombie Survival', fair: 'Zombie Survival' };
const SEND = 1 / 15;   // seconds between state messages
const ZSEND = 0.15;    // and between the horde's, to each guest
const ZRANGE = 260;    // the dead further than this from a guest's car are not sent to it
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;

// where the server is: ?server=, or the page's own address when it came from one (not from a file or an artifact)
export function serverUrl() {
  const s = Q.get('server');
  if (s && /^wss?:\/\//.test(s)) return s.replace(/\/+$/, '') + (/\/ws$/.test(s) ? '' : '/ws');
  if (typeof __AD_SERVER__ !== 'undefined' && __AD_SERVER__) return __AD_SERVER__;
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    if (/claude\.ai|claudeusercontent|anthropic/.test(location.hostname)) return '';
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }
  return '';
}
const store = (() => { try { localStorage.setItem('ad-t', '1'); localStorage.removeItem('ad-t'); return localStorage; } catch (e) { return null; } })();
// who this device is: kept, so a page loaded again is the same player (a test can give each window its own with ?as=)
function myId() {
  const as = (Q.get('as') || '').replace(/\W/g, '').slice(0, 8);
  let id = store && store.getItem('ad-id' + as);
  if (!id) { id = Math.random().toString(36).slice(2, 10) + (as ? '-' + as : ''); try { store && store.setItem('ad-id' + as, id); } catch (e) { /* private */ } }
  return id;
}
export const ME = myId();
// the rejoin key that goes with the id: the relay gives this id's seat back only to the device that has it
const KEY = (() => {
  const as = (Q.get('as') || '').replace(/\W/g, '').slice(0, 8);
  let k = store && store.getItem('ad-key' + as);
  if (!k) { const a = new Uint8Array(12); crypto.getRandomValues(a); k = Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); try { store && store.setItem('ad-key' + as, k); } catch (e) { /* private */ } }
  return k;
})();
// this page load: a car's id has it, so a page that reloaded mid-round makes cars nobody has seen yet
const PAGE = Math.random().toString(36).slice(2, 5);
export function myName() { return (store && store.getItem('ad-name')) || ''; }
function setName(n) { try { store && store.setItem('ad-name', n); } catch (e) { /* private */ } }
// a name for someone who never typed one (kept, so they are the same driver next time)
const nameOrNew = () => { let n = myName(); if (!n) { n = 'Driver ' + (100 + Math.floor(Math.random() * 900)); setName(n); } return n; };
const where = (map, extra) => { const u = new URL(location.href); u.search = ''; u.searchParams.set('map', map); for (const k in extra) if (extra[k]) u.searchParams.set(k, extra[k]); for (const k of ['server', 'as', 'touch']) if (Q.get(k)) u.searchParams.set(k, Q.get(k)); return u.toString(); };
const roundUrl = (m) => where(m.map, { mp: m.round, h: m.host, r: m.room, quick: m.kind === 'quick' ? '1' : '' });   // (not ?q=: quality.js reads that as a held quality step, so every quick round was stuck on step 1)
// back to the lobby after a friends' round: the same room
export const lobbyUrl = (map) => where(map, { room: ROOM });

// ---- one tap: a quick room for this mode, and straight into its round -------------------------------------------
// The relay sends `go` as soon as it has placed us; the page then loads on the round's map. fail(why) if it can't.
export function quickPlay(mode, fail = () => {}) {
  mode = modeKey(mode);
  const url = serverUrl(); if (!url || !MODES.includes(mode)) { fail('Online play needs the game server'); return false; }
  let ws, done = false;
  const stop = (why) => { if (done) return; done = true; clearTimeout(t); try { ws.close(); } catch (e) { /* gone */ } fail(why); };
  const t = setTimeout(() => stop('The server did not answer. Try again.'), 12000);
  try { ws = new WebSocket(url); } catch (e) { stop('Could not reach the server'); return false; }
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', where: 'lobby', id: ME, key: KEY, name: nameOrNew(), touch: navigator.maxTouchPoints > 0, room: 'quick:' + mode }));
  ws.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch (x) { return; }
    if (m.t === 'go') { done = true; clearTimeout(t); leavePage(); location.href = roundUrl(m); }
    else if (m.t === 'busy') stop('The server is full. Try again in a minute.');
  };
  ws.onclose = () => stop('Could not reach the server');
  return true;
}

// ---- the lobby: on the start card ----------------------------------------------------------------------------------
export function makeLobby({ $, MAP, onOpen, onShut, onQuick, onFail }) {
  const url = serverUrl();
  const box = $('online'); if (!box) return null;
  if (!url || ROUND || !MODES.includes(modeKey(MAP.id))) { box.hidden = true; return null; }
  box.hidden = false;
  const nameEl = $('on-name'), panel = $('lobby'), list = $('lb-list'), title = $('lb-title'), sub = $('lb-sub'), startB = $('lb-start'), modesEl = $('lb-modes'), codeIn = $('on-code');
  nameEl.value = myName() || ('Driver ' + (100 + Math.floor(Math.random() * 900)));
  nameEl.addEventListener('change', () => { const n = nameEl.value.trim().slice(0, 16) || 'Driver'; nameEl.value = n; setName(n); send({ t: 'name', name: n }); });
  let ws = null, want = null, st = null, tick = 0, gone = false;
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => { send({ t: 'hello', where: 'lobby', id: ME, key: KEY, name: nameEl.value, touch: navigator.maxTouchPoints > 0, room: want || undefined }); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
    ws.onclose = () => { ws = null; if (!gone && want) setTimeout(connect, 1500); };
  }
  function open(w) {
    setName(nameEl.value.trim().slice(0, 16) || 'Driver');
    want = w; panel.hidden = false; onOpen && onOpen();
    title.textContent = 'Finding a room...'; sub.textContent = ''; list.innerHTML = ''; startB.hidden = true; modesEl.hidden = true;
    if (!ws) connect(); else send({ t: 'join', room: w });
  }
  function shut() { want = null; st = null; panel.hidden = true; send({ t: 'leave' }); onShut && onShut(); }
  function onMsg(m) {
    if (m.t === 'lobby') { st = m; if (m.room.kind === 'friends') want = m.room.code; draw(); }
    else if (m.t === 'nosuch') { title.textContent = `No room ${m.code}`; sub.textContent = 'Check the code and try again.'; want = null; }
    else if (m.t === 'full') { title.textContent = `Room ${m.code} is full`; sub.textContent = ''; want = null; }
    else if (m.t === 'busy') { title.textContent = 'The server is full'; sub.textContent = 'Try again in a minute.'; want = null; }
    else if (m.t === 'go') {
      gone = true; title.textContent = `Starting: ${MODE_NAME[m.map] || m.map}`; sub.textContent = 'Loading the map...';
      leavePage(); location.href = roundUrl(m);
    }
  }
  function draw() {
    if (!st) return;
    const R = st.room, mine = st.host === ME, cars = st.cars;
    if (R.kind === 'quick') {
      title.textContent = `${MODE_NAME[st.pick]}: online`;
      sub.textContent = (R.startIn > 0 ? `Starting in ${Math.ceil(R.startIn / 1000)}` : 'Starting...') + ` · ${st.players.length} of ${cars} · bots take the empty seats`;
    } else {
      title.innerHTML = `Room <b class="code"></b>`; title.querySelector('b').textContent = R.code;
      sub.textContent = `${MODE_NAME[st.pick]} · ${Math.min(st.players.length, cars)} of ${cars} cars are players, bots fill the rest` + (st.round ? ' · a round is on' : '') + (mine ? '' : ' · the host starts it');
    }
    list.innerHTML = '';
    st.players.forEach((p, i) => { const d = document.createElement('div'); d.className = 'lb-p' + (p.id === ME ? ' me' : '') + (i >= cars ? ' out' : ''); d.textContent = p.name + (p.id === st.host && R.kind === 'friends' ? ' (host)' : '') + (p.playing ? ' · playing' : ''); list.appendChild(d); });
    for (let i = st.players.length; i < cars; i++) { const d = document.createElement('div'); d.className = 'lb-p bot'; d.textContent = 'Bot'; list.appendChild(d); }
    startB.hidden = !(R.kind === 'friends' && mine); $('lb-copy').hidden = R.kind !== 'friends';
    modesEl.hidden = !(R.kind === 'friends' && mine && !st.round);
    for (const b of modesEl.querySelectorAll('button')) b.className = b.dataset.m === st.pick ? 'on' : '';
  }
  for (const m of MODES) { const b = document.createElement('button'); b.dataset.m = m; b.textContent = MODE_NAME[m]; b.addEventListener('click', () => send({ t: 'pick', map: m })); modesEl.appendChild(b); }
  // quick play from the card is the same one tap as from the home screen: straight into a round, no panel
  $('on-quick').addEventListener('click', () => { setName(nameEl.value.trim().slice(0, 16) || 'Driver'); if (onQuick) onQuick(); quickPlay(MAP.id, (why) => { title.textContent = why; panel.hidden = false; if (onFail) onFail(why); }); });
  $('on-new').addEventListener('click', () => open('new:' + MAP.id));
  $('on-join').addEventListener('click', () => { const c = codeIn.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4); if (c.length === 4) open(c); else codeIn.focus(); });
  codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('on-join').click(); e.stopPropagation(); });
  nameEl.addEventListener('keydown', (e) => e.stopPropagation());
  $('lb-leave').addEventListener('click', shut);
  startB.addEventListener('click', () => send({ t: 'start' }));
  $('lb-copy').addEventListener('click', () => { if (!st) return; const u = where(st.pick, { room: st.room.code }); try { navigator.clipboard.writeText(u); $('lb-copy').textContent = 'Link copied'; setTimeout(() => { $('lb-copy').textContent = 'Copy link'; }, 1500); } catch (e) { prompt('The link', u); } });
  setInterval(() => { if (st && st.room.kind === 'quick' && st.room.startIn > 0) { st.room.startIn = Math.max(0, st.room.startIn - 250); draw(); } }, 250);
  // came back from a round, or opened a shared link: straight into the room
  const back = Q.get('room') ? Q.get('room').replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4) : '';
  if (back) setTimeout(() => open(back), 50);
  return { open, shut, get state() { return st; } };
}

// ---- the round -------------------------------------------------------------------------------------------------------
// o: what it needs from main.js (see there): cars, addCar, wreck, gadget, player(), mode, MAP, game, api, startGame,
// toast, banner, $, onLand (pickups), horde()
export function makeNet(o) {
  if (!ROUND) return null;
  const url = serverUrl(); if (!url) return null;
  const { cars, game } = o;
  const N = {
    on: true, me: ME, host: HOST0 === ME, hostId: HOST0, round: ROUND, slot: 0, bots: 0, players: [], begun: false, ready: false,
    names: new Map(), seats: new Map(),   // player id -> name; car seat -> its newest car
    lobby: () => lobbyUrl(o.MAP.id), quick: QUICK, room: ROOM,
    startAt: 0,      // (performance.now()) when the countdown is out, while it runs
    spawn: null,     // where this player's car starts: a bot's spot, when it came late into the bot's seat
    lateBy: 0,       // seconds the round had been going when this page joined it
  };
  let ws = null, q = [], sendT = 0, zT = 0, keepT = 0, seq = 0, closed = false, welcomed = false, fresh = true, seed = null, clock = null;
  const byId = new Map();         // car id -> car (puppets and our own)
  const info = new Map();         // car id -> what its owner said about it (to build the puppet)
  const asked = new Map();        // car id -> when we asked its owner for it
  const forgot = new Set();       // wrecks cleared away: a late message about one is ignored
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  function connect() {
    ws = new WebSocket(url);
    // fresh: this page has just loaded (a reload mid-round has lost its car's score and, on the host, the bots: the relay
    // sends them back). After a dropped connection the page still has them.
    ws.onopen = () => { send({ t: 'hello', where: 'game', id: ME, key: KEY, name: myName() || 'Driver', round: ROUND, fresh }); fresh = false; if (N.ready) sendReady(); };
    ws.onmessage = (e) => { try { q.push(JSON.parse(e.data)); } catch (x) { /* not ours */ } };
    ws.onclose = () => { ws = null; if (!closed) setTimeout(connect, 1200); };
  }
  connect();
  // In the background the page stops drawing: the others are told, and a host's bots move to another device soon after
  document.addEventListener('visibilitychange', () => { if (welcomed) send({ t: 'away', on: document.visibilityState === 'hidden' }); });
  const sendReady = () => send({ t: 'ready', len: o.mode.netLen || undefined });
  N.send = send;
  N.bye = () => { closed = true; send({ t: 'bye' }); };
  // the map is built: ready (quick play and friends' rounds alike: the round starts when everyone is, no button)
  N.ready_ = () => { if (N.ready) return; N.ready = true; sendReady(); };
  // seconds left on the server's clock (a mode on a clock: the arena), or 0
  N.clockLeft = () => (clock ? Math.max(0, clock.left - (performance.now() - clock.at) / 1000) : 0);
  const clockAt = (ms) => { if (ms > 0) { clock = { left: ms / 1000, at: performance.now() }; if (N.begun && o.mode.netClock) o.mode.netClock(N.clockLeft()); } };
  const roster = (m) => {
    if (m.players) { N.players = m.players; for (const p of m.players) N.names.set(p.id, p.name); const mine = m.players.find((p) => p.id === ME); if (mine) N.slot = mine.slot; }
    if (typeof m.bots === 'number') N.bots = m.bots;
    if (o.onRoster) o.onRoster();
  };
  N.nameOf = (id) => N.names.get(id) || 'Driver';
  // a car of ours gets an id and a seat (the player's is the player's id; a bot's is its name, kept when it comes back
  // from a wreck as a new car), and everyone is told what it is
  function own(c) {
    c.nid = ME + '.' + PAGE + (seq++).toString(36); c.owner = ME;
    c.seat = c === o.player() ? ME : 'b:' + c.name;
    byId.set(c.nid, c); N.seats.set(c.seat, c);
    send(carMsg(c));
  }
  const carMsg = (c) => ({ t: 'car', id: c.nid, seat: c.seat, name: c.seat === ME ? N.nameOf(ME) : c.name, load: c.load, rival: !!c.rival, hp: c.hp, maxHp: c.maxHp, x: r1(c.x), z: r1(c.z), yaw: r2(c.yaw) });
  N.local = (c) => !c.remote;
  N.carById = (id) => byId.get(id) || null;
  N.carOf = (seat) => N.seats.get(seat) || null;

  // ---- what our cars send: where they are, about 15 times a second ----
  function state(c) {
    const f = c.dead ? [] : c.lastWant || [];
    const bits = (f[0] ? 1 : 0) | (f[1] ? 2 : 0), flags = (c.shield > 0 ? 1 : 0) | (c.boostT > 0 ? 2 : 0) | (c.drift ? 4 : 0) | (c.shieldT > 0 ? 8 : 0) | (c.overT > 0 ? 16 : 0) | (c.flameT > 0 ? 32 : 0);
    const ex = o.mode.netState ? o.mode.netState(c) : 0;
    return [c.nid, r1(c.x), r1(c.z), r1(c.y || 0), r2(c.yaw), r1(c.vx), r1(c.vz), r1(c.aim.x), r1(c.aim.y), r1(c.aim.z), bits, r1(c.hp), Math.round(c.maxHp), flags, r2(c.steer || 0), r2(c.throttle || 0), r2(c.skid || 0), r2(c.slide || 0), ex];
  }
  // ---- a puppet: someone else's car ----
  function puppet(m, from) {
    if (byId.has(m.id) || forgot.has(m.id)) return byId.get(m.id);
    const c = o.addCar({ ...m.load, name: m.name }, { x: m.x, z: m.z, yaw: m.yaw }, m.rival, { remote: true });
    c.remote = true; c.nid = m.id; c.owner = from; c.seat = m.seat; c.human = m.seat === from && !m.rival;
    c.maxHp = m.maxHp; c.hp = m.hp; c.want = [false, false]; c.net = null; c.turretTurn = 10;
    byId.set(c.nid, c);
    const was = N.seats.get(c.seat); N.seats.set(c.seat, c);
    if (o.mode.netCar) o.mode.netCar(c, was);
    // the same seat's old car, still standing: its page reloaded (a wreck lies where it fell and crumbles on its own)
    if (was && was !== c && was.remote && !was.dead && !was.gone) drop(was);
    return c;
  }
  // a car taken out of the round on every device: a bot whose seat a player took, a player who left
  function drop(c) {
    if (o.mode.netDrop) o.mode.netDrop(c);
    if (N.seats.get(c.seat) === c) N.seats.delete(c.seat);
    if (c.nid) { forgot.add(c.nid); byId.delete(c.nid); }
    o.removeCar(c);
  }
  // the bots, for the relay to keep (it hands them back to a host whose page reloaded with nobody else on)
  const myBots = () => cars.filter((c) => !c.remote && c.nid && c.seat && c.seat.startsWith('b:') && !c.gone);
  const botList = () => myBots().map((c) => ({ id: c.nid, seat: c.seat, name: c.name, load: c.load, x: r1(c.x), z: r1(c.z), yaw: r2(c.yaw), hp: r1(c.hp), maxHp: Math.round(c.maxHp), dead: !!c.dead, s: state(c) }));
  // a puppet of ours from here: this device drives it
  function adoptCar(c) { c.remote = false; c.owner = ME; c.net = null; if (o.mode.adopt) o.mode.adopt(c); send(carMsg(c)); }
  // this device hosts from now on: the bots (and the horde) are ours, where they stand
  function takeOver(quiet) {
    const was = N.host; N.host = true; N.hostId = ME;
    for (const c of [...cars]) if (c.remote && !c.human) adoptCar(c);
    const h = o.horde(); if (h && h.adopt) h.adopt();
    if (!was && !quiet && N.begun) o.toast('You host the bots now', '');
  }
  // another device hosts from now on (this one was away too long): the bots here become its puppets
  function release(now) {
    N.host = false; N.hostId = now;
    for (const c of myBots()) { c.remote = true; c.owner = now; c.driver = null; c.net = null; c.want = [false, false]; if (o.mode.release) o.mode.release(c); }
    const h = o.horde(); if (h && h.release) h.release();
  }
  // the host's page reloaded mid-round with nobody else on: the bots as the relay last had them, made as puppets and
  // taken over at once (so each mode sets them up as it does a bot taken over from a host who left)
  function reseed(list) {
    const make = (e) => { const c = puppet({ id: e.id, seat: e.seat, name: e.name, load: e.load, rival: true, hp: e.hp, maxHp: e.maxHp, x: e.x, z: e.z, yaw: e.yaw }, 'relay'); if (c && Array.isArray(e.s)) take(c, e.s, 'relay'); return c; };
    for (const e of list) { if (!e || !e.load) continue; if (!e.dead) make(e); else if (o.mode.netRevive) o.mode.netRevive(e, make); }
    takeOver(true);
  }
  function take(c, p, from) {
    c.owner = from;
    const n = c.net || (c.net = { x: p[1], z: p[2], yaw: p[4], at: 0 });
    n.x = p[1]; n.z = p[2]; n.y = p[3]; n.yaw = p[4]; n.vx = p[5]; n.vz = p[6]; n.at = performance.now();
    if (!c.seen) { c.seen = true; c.x = n.x; c.z = n.z; c.yaw = n.yaw; c.gunYaw = n.yaw; }
    c.aim.set(p[7], p[8], p[9]); c.want[0] = !!(p[10] & 1); c.want[1] = !!(p[10] & 2);
    const hp = p[11]; if (hp < c.hp - 0.5) c.hurtT = 0.25; c.hp = hp; c.maxHp = p[12];
    const fl = p[13]; c.shield = fl & 1 ? 0.3 : 0; if (fl & 2) c.boostT = Math.max(c.boostT || 0, 0.2); c.drift = !!(fl & 4); c.overT = fl & 16 ? 0.2 : 0;
    c.steer = p[14]; c.throttle = p[15]; c.skid = p[16]; c.slide = p[17];
    if (o.mode.netTake) o.mode.netTake(c, p[18]);
  }
  // moved towards where its owner last said it was (and where it will be by now, at the speed it was going)
  N.drive = (c, dt) => {
    const n = c.net; if (!n || c.dead) { c.vx *= 0.9; c.vz *= 0.9; return; }
    const age = Math.min(0.25, (performance.now() - n.at) / 1000 + 0.05);
    const tx = n.x + n.vx * age, tz = n.z + n.vz * age, dx = tx - c.x, dz = tz - c.z;
    if (Math.hypot(dx, dz) > 40) { c.x = tx; c.z = tz; c.yaw = n.yaw; }
    else { const k = 1 - Math.exp(-14 * dt); c.x += dx * k; c.z += dz * k; }
    const was = c.yaw; c.yaw = wrapA(c.yaw + wrapA(n.yaw - c.yaw) * (1 - Math.exp(-14 * dt)));
    c.yawRate = dt > 0 ? wrapA(c.yaw - was) / dt : 0;
    c.y = c.y + ((n.y || 0) - (c.y || 0)) * (1 - Math.exp(-14 * dt));
    if (o.MAP.floor) c.fy = o.MAP.floor(c.x, c.z, c.h);   // the road under it, where the map's road climbs (maps/heights.js)
    c.vx = n.vx; c.vz = n.vz;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    c.fwd = c.vx * fx + c.vz * fz; c.speed = Math.hypot(c.vx, c.vz);
    if (c.boostT > 0) c.boostT -= dt;
  };

  // ---- the messages ----
  function onMsg(m) {
    const from = m.from;
    switch (m.t) {
      case 'welcome': {
        const first = !welcomed; welcomed = true; N.hostId = m.host; N.host = m.host === ME;
        roster(m);
        if (m.startIn > 0) N.startAt = performance.now() + m.startIn;
        if (m.spawn && first) N.spawn = m.spawn;
        clockAt(m.left);
        if (m.back && o.mode.netLoad) N.back = m.back;   // a reload mid-round: the scores as they were, put back when it starts
        // the host's page reloaded with nobody else on: the bots as the relay last had them, once the round is up here
        if (m.botList && N.host) { seed = m.botList; N.host = false; }
        if (o.onWelcome) o.onWelcome(m);
        if (m.begun >= 0 && !N.begun) { N.begun = true; N.lateBy = m.begun / 1000; }
        for (const c of cars) if (c.nid && !c.remote) send(carMsg(c));
        break;
      }
      case 'noround': o.noRound(); closed = true; break;
      case 'joined': N.names.set(m.id, m.name); for (const c of cars) if (c.nid && !c.remote) send({ ...carMsg(c), to: m.id }); for (const c of cars) if (c.owner === m.id) c.away = false; break;
      case 'add': roster({ players: [...N.players.filter((p) => p.id !== m.id), { id: m.id, slot: m.slot, name: m.name }], bots: m.bots }); break;   // one more player before the start
      case 'begin': roster(m); if (m.host) { N.hostId = m.host; N.host = m.host === ME && !seed; } clockAt(m.left); if (!N.started) { N.started = true; N.begun = true; setTimeout(o.begin, m.in || 0); } break;
      case 'host': {   // the host has been gone a while: the next player's device runs the bots from now on
        if (m.now === ME) { if (!N.host) takeOver(); }
        else if (N.host && N.begun) release(m.now);
        else { N.host = false; N.hostId = m.now; }
        break;
      }
      case 'seat': {   // a new player takes over a bot's seat: the bot goes, on every device
        roster({ players: [...N.players.filter((p) => p.id !== m.id), { id: m.id, slot: m.slot, name: m.name }], bots: m.bots });
        let c = m.bot && N.seats.get(m.bot);
        if ((!c || c.gone) && N.host) { c = myBots().find((b) => !b.dead) || myBots()[0]; if (c) send({ t: 'drop', seat: c.seat }); }   // (the relay had no bot list yet: the host picks)
        if (c && !c.gone) drop(c);
        if (N.begun) o.toast(`${m.name} joined`, 'In place of a bot');
        break;
      }
      case 'drop': { const c = N.seats.get(m.seat); if (c && !c.gone && c.remote) drop(c); break; }
      case 'away': for (const c of cars) if (c.remote && c.owner === from && c.human) { c.away = !!m.on; if (c.tag) c.tag.classList.toggle('away', c.away); } break;
      case 'clock': clockAt(m.left); break;
      case 'left': left(m); break;
      case 'end': if (m.from === 'server') { if (o.mode.netEnd) o.mode.netEnd(); } else if (m.next) o.toast('The host started a new round', 'Back to the lobby to join it'); break;
      case 'car': if (from !== ME && !byId.has(m.id)) { info.set(m.id, m); puppet(m, from); } break;
      case 'need': { const c = byId.get(m.id); if (c && !c.remote) send({ ...carMsg(c), to: from }); break; }
      case 's':
        for (const p of m.c) {
          if (forgot.has(p[0])) continue;
          let c = byId.get(p[0]);
          if (!c) { const t = asked.get(p[0]) || 0; if (performance.now() - t > 1500) { asked.set(p[0], performance.now()); send({ t: 'need', id: p[0], to: from }); } continue; }
          if (c.remote) take(c, p, from);
        }
        break;
      case 'w': {   // a car wrecked on its owner's device
        const c = byId.get(m.id); if (N.log) N.log.push(['in', m.id, m.by, !!c, c && c.dead, c && c.name, m.by && byId.get(m.by) && byId.get(m.by).name]);
        if (!c || !c.remote || c.dead) break;
        o.wreck(c, (m.by && byId.get(m.by)) || null);
        break;
      }
      case 'hurt': {   // damage worked out on another device (the dead's claws, a stomp), for one of our cars
        const c = byId.get(m.id); if (c && !c.remote) o.damage(c, m.d, (m.by && byId.get(m.by)) || null);
        break;
      }
      case 'gd': { const c = byId.get(m.id); if (c && c.remote && !c.dead) { c.gadgetT = 0; o.gadget(c); } break; }
      case 'pk': { const c = byId.get(m.id); if (o.pickups && o.pickups.taken) o.pickups.taken(m.i, c && c.remote ? c : null, m.n); break; }
      case 'z': { const h = o.horde(); if (h && h.take) h.take(m, N); break; }
      case 'zk': { const h = o.horde(); if (h) { h.byPlayer += m.n; game.scrap += m.n; } break; }
      case 'm': if (o.mode.netMsg) o.mode.netMsg(m, from); break;
    }
  }
  // someone left. One who quit: their car goes. One who dropped out may be back in a moment (a page that reloaded makes
  // a new car, which takes the old one's place): their car waits, marked away, and goes if nothing comes from it. If they
  // hosted, the relay says who hosts next ('host').
  function left(m) {
    const theirs = () => cars.filter((c) => c.remote && c.owner === m.id && c.human && !c.gone);
    if (m.quit) { for (const c of theirs()) drop(c); o.toast(`${N.nameOf(m.id)} left`, ''); return; }
    for (const c of theirs()) { c.away = true; if (c.tag) c.tag.classList.add('away'); }
    setTimeout(() => { for (const c of theirs()) if (c.away && (!c.net || performance.now() - c.net.at > 25000)) drop(c); }, 30000);
  }
  // what our device said hit someone else's car (the dead's claws, a stomp from the jump jets): to its owner
  N.hurt = (c, d, who) => { if (c.remote && c.nid) send({ t: 'hurt', to: c.owner, id: c.nid, d: r1(d), by: who && who.nid }); };
  N.wrecked = (c, who) => {
    const by = who || (o.MAP.mode === 'brawl' && c.lastBy && c.lastBy !== c ? c.lastBy : null);   // (the arena: a wreck by a trap is the last hitter's)
    if (N.log) N.log.push(['out', c.nid, by && by.nid, c.name, by && by.name]);
    if (!c.remote && c.nid) send({ t: 'w', id: c.nid, by: by && by.nid });
  };
  N.gadget = (c) => { if (!c.remote && c.nid) send({ t: 'gd', id: c.nid }); };
  N.picked = (i, c, n) => { if (c && !c.remote) send({ t: 'pk', i, id: c.nid, n: r1(n) }); };
  N.zkill = (c, n = 1) => { if (c && c.remote && c.human) send({ t: 'zk', to: c.owner, n }); };
  N.msg = (m) => send({ ...m, t: 'm' });
  N.forget = (c) => { if (c.nid) { forgot.add(c.nid); byId.delete(c.nid); } };
  // the countdown before the start, while it runs (seconds), for the start card
  N.startIn = () => (N.startAt && !N.begun ? Math.max(0, (N.startAt - performance.now()) / 1000) : 0);

  // ---- each frame: read what came, and send ours ----
  N.step = (dt) => {
    for (const m of q.splice(0)) onMsg(m);
    for (const c of cars) if (!c.remote && !c.dummy && !c.nid && welcomed) own(c);
    if (!N.begun) return;
    if (game.state === 'play' || game.state === 'dead' || game.state === 'over') {
      // the round is up here: a reloaded host's bots come back, and so do the scores
      if (seed) { const list = seed; seed = null; reseed(list); }
      if (N.back) { const b = N.back; N.back = null; o.mode.netLoad(b, N.nameOf(ME)); }
    }
    if ((sendT += dt) >= SEND) {
      sendT = 0;
      const list = []; for (const c of cars) if (!c.remote && c.nid && !c.dead && !c.gone) list.push(state(c));
      const m = { t: 's', c: list };
      // about once a second: this device's score (the mode's), and the host's bots, for the relay to keep
      if ((keepT += SEND) >= 1) { keepT = 0; if (o.mode.netSave && game.state !== 'menu') m.k = o.mode.netSave(N.nameOf(ME)); if (N.host) m.b = botList(); }
      if (list.length || m.k !== undefined || m.b) send(m);
    }
    const h = o.horde();
    if (N.host && h && h.pack && (zT += dt) >= ZSEND) {
      zT = 0;
      const kill = h.deaths ? h.deaths.splice(0) : [];
      for (const p of N.players) {
        if (p.id === ME) continue;
        const c = N.seats.get(p.id); if (!c) continue;
        send({ t: 'z', to: p.id, ...h.pack(c, ZRANGE, N), d: kill });
      }
    }
  };
  return N;
}
export { MODE_NAME };
