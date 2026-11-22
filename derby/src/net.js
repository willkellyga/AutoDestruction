// Playing online (derby/server: the lobby and the relay). Two halves:
//
// The lobby, on the start card: a name, "Play online" (a quick room for the mode on the card, filled with bots when the
// countdown runs out) and "With friends" (a room with a four-letter code; whoever made it picks the mode and starts).
// When a round starts, the page loads again on its map as ?map=<mode>&mp=<round>&h=<host> (the world is laid out once,
// as the page loads).
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
//
// Without ?mp= in the address none of the round half runs, and the game is as it was.
const Q = new URLSearchParams(location.search);
export const ROUND = (Q.get('mp') || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
const HOST0 = Q.get('h') || '';
const ROOM = (Q.get('r') || '').replace(/[^A-Z]/gi, '').slice(0, 4).toUpperCase(), QUICK = Q.get('q') === '1';
const MODES = ['arena', 'race', 'base'];
const MODE_NAME = { arena: 'Arena', race: 'Race', base: 'Zombie Survival' };
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
export function myName() { return (store && store.getItem('ad-name')) || ''; }
function setName(n) { try { store && store.setItem('ad-name', n); } catch (e) { /* private */ } }
const where = (map, extra) => { const u = new URL(location.href); u.search = ''; u.searchParams.set('map', map); for (const k in extra) if (extra[k]) u.searchParams.set(k, extra[k]); for (const k of ['server', 'as', 'q', 'touch']) if (Q.get(k) && k !== 'q') u.searchParams.set(k, Q.get(k)); return u.toString(); };
// back to the lobby after a round: the same friends' room, or a new quick room for the same mode
export const lobbyUrl = (map) => (ROOM && !QUICK ? where(map, { room: ROOM }) : where(map, { online: 'quick' }));

// ---- the lobby: on the start card ----------------------------------------------------------------------------------
export function makeLobby({ $, MAP, onOpen, onShut }) {
  const url = serverUrl();
  const box = $('online'); if (!box) return null;
  if (!url || ROUND || !MODES.includes(MAP.id)) { box.hidden = true; return null; }
  box.hidden = false;
  const nameEl = $('on-name'), panel = $('lobby'), list = $('lb-list'), title = $('lb-title'), sub = $('lb-sub'), startB = $('lb-start'), modesEl = $('lb-modes'), codeIn = $('on-code');
  nameEl.value = myName() || ('Driver ' + (100 + Math.floor(Math.random() * 900)));
  nameEl.addEventListener('change', () => { const n = nameEl.value.trim().slice(0, 16) || 'Driver'; nameEl.value = n; setName(n); send({ t: 'name', name: n }); });
  let ws = null, want = null, st = null, tick = 0, gone = false;
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => { send({ t: 'hello', where: 'lobby', id: ME, name: nameEl.value, touch: navigator.maxTouchPoints > 0, room: want || undefined }); };
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
      location.href = where(m.map, { mp: m.round, h: m.host, r: m.room, q: m.kind === 'quick' ? '1' : '' });
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
  $('on-quick').addEventListener('click', () => open('quick:' + MAP.id));
  $('on-new').addEventListener('click', () => open('new:' + MAP.id));
  $('on-join').addEventListener('click', () => { const c = codeIn.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4); if (c.length === 4) open(c); else codeIn.focus(); });
  codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('on-join').click(); e.stopPropagation(); });
  nameEl.addEventListener('keydown', (e) => e.stopPropagation());
  $('lb-leave').addEventListener('click', shut);
  startB.addEventListener('click', () => send({ t: 'start' }));
  $('lb-copy').addEventListener('click', () => { if (!st) return; const u = where(st.pick, { room: st.room.code }); try { navigator.clipboard.writeText(u); $('lb-copy').textContent = 'Link copied'; setTimeout(() => { $('lb-copy').textContent = 'Copy link'; }, 1500); } catch (e) { prompt('The link', u); } });
  setInterval(() => { if (st && st.room.kind === 'quick' && st.room.startIn > 0) { st.room.startIn = Math.max(0, st.room.startIn - 250); draw(); } }, 250);
  // came back from a round, or opened a shared link: straight into the room
  const back = Q.get('room') ? Q.get('room').replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4) : Q.get('online') === 'quick' ? 'quick:' + MAP.id : '';
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
  };
  let ws = null, q = [], sendT = 0, zT = 0, seq = 0, closed = false, welcomed = false;
  const byId = new Map();         // car id -> car (puppets and our own)
  const info = new Map();         // car id -> what its owner said about it (to build the puppet)
  const asked = new Map();        // car id -> when we asked its owner for it
  const forgot = new Set();       // wrecks cleared away: a late message about one is ignored
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => { send({ t: 'hello', where: 'game', id: ME, name: myName() || 'Driver', round: ROUND }); if (N.ready) send({ t: 'ready' }); };
    ws.onmessage = (e) => { try { q.push(JSON.parse(e.data)); } catch (x) { /* not ours */ } };
    ws.onclose = () => { ws = null; if (!closed) setTimeout(connect, 1200); };
  }
  connect();
  N.send = send;
  N.bye = () => { closed = true; send({ t: 'bye' }); };
  N.ready_ = () => { if (N.ready) return; N.ready = true; send({ t: 'ready' }); };
  N.nameOf = (id) => N.names.get(id) || 'Driver';
  // a car of ours gets an id and a seat (the player's is the player's id; a bot's is its name, kept when it comes back
  // from a wreck as a new car), and everyone is told what it is
  function own(c) {
    c.nid = ME + '.' + (seq++).toString(36); c.owner = ME;
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
    return c;
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
        welcomed = true; N.hostId = m.host; N.host = m.host === ME; N.bots = m.bots; N.players = m.players;
        for (const p of m.players) N.names.set(p.id, p.name);
        const mine = m.players.find((p) => p.id === ME); N.slot = mine ? mine.slot : 0;
        if (o.onWelcome) o.onWelcome(m);
        if (m.begun >= 0) { N.begun = true; N.lateBy = m.begun / 1000; }
        for (const c of cars) if (c.nid && !c.remote) send(carMsg(c));
        break;
      }
      case 'noround': o.noRound(); closed = true; break;
      case 'joined': N.names.set(m.id, m.name); for (const c of cars) if (c.nid && !c.remote) send({ ...carMsg(c), to: m.id }); break;
      case 'begin': if (!N.begun) { N.begun = true; setTimeout(o.begin, m.in || 0); } break;
      case 'left': left(m); break;
      case 'end': if (m.next) o.toast('The host started a new round', 'Back to the lobby to join it'); break;
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
  // someone left: their car goes, and if they hosted, the next player hosts. When that is us, the bots (and the horde)
  // are ours from here, where they stand.
  function left(m) {
    for (const c of [...cars]) if (c.remote && c.owner === m.id && c.human) { forgot.add(c.nid); byId.delete(c.nid); o.removeCar(c); }
    o.toast(`${N.nameOf(m.id)} left`, '');
    if (!m.host) return;
    N.hostId = m.now; const was = N.host; N.host = m.now === ME;
    if (N.host && !was) {
      for (const c of [...cars]) if (c.remote && c.owner === m.id && !c.human) { c.remote = false; c.owner = ME; c.net = null; if (o.mode.adopt) o.mode.adopt(c); send(carMsg(c)); }
      const h = o.horde(); if (h && h.adopt) h.adopt();
      o.toast('You host the bots now', '');
    }
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

  // ---- each frame: read what came, and send ours ----
  N.step = (dt) => {
    for (const m of q.splice(0)) onMsg(m);
    for (const c of cars) if (!c.remote && !c.dummy && !c.nid && welcomed) own(c);
    if (!N.begun) return;
    if ((sendT += dt) >= SEND) {
      sendT = 0;
      const list = []; for (const c of cars) if (!c.remote && c.nid && !c.dead && !c.gone) list.push(state(c));
      if (list.length) send({ t: 's', c: list });
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
