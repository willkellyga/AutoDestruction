// Auto Destruction's lobby and round relay (derby/server/server.mjs serves it at /ws). Copied from Monster Mayhem's
// (playtest/relay.mjs) and changed for cars: rooms are for one of the three modes, and each mode has its own size.
//   - Play online (quick play): pick a mode, and the server puts you in the fullest open room for it; a 10 second
//     countdown starts with the first player in, and the round starts when it runs out (at once when it is full).
//   - With friends: a room with a four-letter code. Whoever made it hosts: picks the mode and taps Start. The room stays
//     together between rounds until everyone has gone for 10 minutes.
// Bots take every seat nobody fills: the host's device drives them (derby/src/net.js).
// In a round each device drives its own car and sends where it is about 15 times a second; this only passes messages
// on to the others in the same round, it runs none of the game. When the host leaves mid-round the round goes on and the
// next player in hosts (their device takes over the bots).
// A small WebSocket server with no dependencies (text frames only, which is all the game sends).
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
// the modes (the game's map ids), with how many cars a round has: players and bots together, and so the most players
export const MODES = { arena: { name: 'Arena', max: 8 }, race: { name: 'Race', max: 6 }, base: { name: 'Zombie Survival', max: 6 } };
const MAX_SEATS = 8;      // the most players in a friends' room (a round takes as many as its mode has room for)
const modeOf = (m) => (MODES[m] ? m : 'arena');
const QUICK_WAIT = 10000;   // quick play's countdown, from the first player in
const QUICK_FULL = 1500;    // ...cut to this once the room is full
const FRIENDS_KEEP = 600000;   // a friends' room with nobody in it is kept this long, for whoever comes back
const AWAY = 90000;         // a player gone this long (no lobby, no game page) leaves their room
const MAX_ROOMS = 400;      // more than one small machine could run anyway
const ROUND_MAX = 20 * 60000;   // a round nobody ended (rounds are 2 to 4 minutes, survival can run on) is let go after this
const nameOf = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Driver';
// room codes: four letters with no vowels (so no words) and none that look alike
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
const codeOf = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

function frame(text) {
  const body = Buffer.from(text), n = body.length;
  const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0]), Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])]);
  return Buffer.concat([head, body]);
}

// what went through, for the log line every minute and /stats
const tally = { inMsgs: 0, inBytes: 0, outMsgs: 0, outBytes: 0, dropped: 0 };

// one connection: calls onText for each message, and says when it closes
function wrap(sock, onText, onClose) {
  let buf = Buffer.alloc(0), parts = [], closed = false, heard = Date.now();
  // a frame already made (the same one goes to everyone in the round); a state update is skipped for a connection that is
  // far behind, since the next one is a fifteenth of a second away
  const write = (f, state) => {
    if (closed) return;
    if (state && sock.writableLength > 4e6) { tally.dropped++; return; }
    tally.outMsgs++; tally.outBytes += f.length;
    try { sock.write(f); } catch (e) { /* gone */ }
  };
  const c = {
    get heard() { return heard; },
    send(obj) { write(frame(typeof obj === 'string' ? obj : JSON.stringify(obj)), obj && obj.t === 's'); },
    sendFrame: write,
    ping() { if (!closed) try { sock.write(Buffer.from([0x89, 0])); } catch (e) { /* gone */ } },
    close() { if (closed) return; closed = true; try { sock.end(Buffer.from([0x88, 0])); setTimeout(() => sock.destroy(), 2000).unref(); } catch (e) { /* gone */ } onClose(c); },
    get open() { return !closed; },
  };
  sock.on('data', (d) => {
    heard = Date.now();
    buf = buf.length ? Buffer.concat([buf, d]) : d;
    for (;;) {
      if (buf.length < 2) return;
      const op = buf[0] & 15, fin = buf[0] & 128, masked = buf[1] & 128;
      let len = buf[1] & 127, at = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); at = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = buf.readUInt32BE(6); at = 10; }
      if (len > 8e6) { c.close(); return; }
      const need = at + (masked ? 4 : 0) + len;
      if (buf.length < need) return;
      let data = buf.subarray(at + (masked ? 4 : 0), need);
      if (masked) { const m = buf.subarray(at, at + 4); data = Buffer.from(data); for (let i = 0; i < data.length; i++) data[i] ^= m[i & 3]; }
      buf = buf.subarray(need);
      if (op === 8) { c.close(); return; }
      if (op === 9) { try { sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); } catch (e) { /* gone */ } continue; }
      if (op === 10) continue;
      if (op === 1 || op === 0) {
        parts.push(data);
        if (fin) { const raw = Buffer.concat(parts), text = raw.toString('utf8'); parts = []; tally.inMsgs++; tally.inBytes += raw.length; let m; try { m = JSON.parse(text); } catch (e) { continue; } if (m && typeof m === 'object') onText(c, m, text); }
      }
    }
  });
  // the other end went away: a page that was closed sends a FIN, which on an http server's socket only half-closes it
  sock.on('end', () => { if (!closed) { closed = true; try { sock.destroy(); } catch (e) { /* gone */ } onClose(c); } });
  sock.on('close', () => { if (!closed) { closed = true; onClose(c); } });
  sock.on('error', () => { if (!closed) { closed = true; onClose(c); } });
  return c;
}

// the lobby and the relay, on an http server's /ws
export function attachRelay(server, { log = () => {} } = {}) {
  const players = new Map();   // id -> { id, name, lobby: conn, game: conn, joined, room: code, touch }
  const rooms = new Map();     // code -> { code, kind: 'quick' | 'friends', mode, made, members: Map(id -> joined), pick, round, startAt, timer, quiet }
  const rounds = new Map();    // round id -> room
  const online = (p) => !!p && ((p.lobby && p.lobby.open) || (p.game && p.game.open));
  const inLobby = (p) => !!p && !!p.lobby && p.lobby.open;

  // ---- rooms ----
  function makeRoom(kind, mode) {
    let code; do { code = ''; for (let i = 0; i < 4; i++) code += CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)]; } while (rooms.has(code));
    const r = { code, kind, made: Date.now(), members: new Map(), pick: modeOf(mode), round: null, startAt: 0, timer: null, quiet: Date.now() };
    rooms.set(code, r); return r;
  }
  // how many seats a room has: its mode's cars (a quick room), or up to eight friends
  const roomMax = (r) => (r.kind === 'quick' ? MODES[r.pick].max : MAX_SEATS);
  // who is in the room now, in the order they came
  const here = (r) => [...r.members.keys()].map((id) => players.get(id)).filter(online).sort((a, b) => r.members.get(a.id) - r.members.get(b.id));
  // the host: whoever has been in the room longest (in a round, the round's own host)
  const hostOf = (r) => { const h = here(r)[0]; return h ? h.id : null; };
  const seats = (r) => here(r).length;
  function leaveRoom(p) {
    const r = p.room && rooms.get(p.room); p.room = null;
    if (!r) return;
    r.members.delete(p.id);
    if (r.kind === 'quick' && !r.round && !seats(r)) dropRoom(r);
    else tellRoom(r);
  }
  function dropRoom(r) { clearTimeout(r.timer); if (r.round) rounds.delete(r.round.id); rooms.delete(r.code); }
  function joinRoom(p, r) {
    if (p.room === r.code) { tellRoom(r); return true; }
    if (!r.members.has(p.id) && seats(r) >= roomMax(r)) return false;
    leaveRoom(p);
    r.members.set(p.id, Date.now()); p.room = r.code;
    if (r.kind === 'quick' && !r.round) {
      if (!r.startAt) r.startAt = Date.now() + QUICK_WAIT;
      if (seats(r) >= roomMax(r)) r.startAt = Math.min(r.startAt, Date.now() + QUICK_FULL);
      clearTimeout(r.timer); r.timer = setTimeout(() => quickGo(r), Math.max(0, r.startAt - Date.now()));
    }
    tellRoom(r); return true;
  }
  // quick play: the open room for this mode with the most players in it (then the one starting soonest), or a new one
  function quickRoom(mode) {
    let best = null;
    for (const r of rooms.values()) {
      if (r.kind !== 'quick' || r.pick !== mode || r.round || r.startAt - Date.now() < 800) continue;
      const n = seats(r); if (n >= roomMax(r)) continue;
      if (!best || n > best.n || (n === best.n && r.startAt < best.r.startAt)) best = { r, n };
    }
    if (best) return best.r;
    return rooms.size < MAX_ROOMS ? makeRoom('quick', mode) : null;
  }
  function quickGo(r) {
    r.timer = null;
    if (!rooms.has(r.code) || r.round) return;
    const ids = here(r).filter(inLobby).map((p) => p.id);
    if (!ids.length) { dropRoom(r); return; }
    // the bots run on the host's device, so a computer hosts before a phone or a tablet when there is one
    const host = (ids.map((id) => players.get(id)).find((p) => !p.touch) || players.get(ids[0])).id;
    startRound(r, ids, host);
  }

  function lobbyState(r) {
    const h = hostOf(r), round = r.round;
    return { t: 'lobby', room: { code: r.code, kind: r.kind, max: roomMax(r), startIn: r.kind === 'quick' && !round && r.startAt ? Math.max(0, r.startAt - Date.now()) : 0 },
      host: h, pick: r.pick, cars: MODES[r.pick].max, round: round && { id: round.id, map: round.map, ids: round.ids, begun: round.begun },
      players: here(r).map((p) => ({ id: p.id, name: p.name, playing: !!(round && round.ids.includes(p.id) && p.game && p.game.open) })) };
  }
  function tellRoom(r) {
    if (!rooms.has(r.code)) return;
    let f = null;
    for (const id of r.members.keys()) { const p = players.get(id); if (inLobby(p) && p.room === r.code) p.lobby.sendFrame(f || (f = frame(JSON.stringify(lobbyState(r))))); }
  }
  // the menu (no room yet) shows how many are playing
  function hubState() { let n = 0, inRounds = 0; for (const p of players.values()) if (online(p)) { n++; if (p.game && p.game.open) inRounds++; } return { t: 'hub', online: n, playing: inRounds }; }
  function tellHub() { let f = null; for (const p of players.values()) if (inLobby(p) && !p.room) p.lobby.sendFrame(f || (f = frame(JSON.stringify(hubState())))); }

  // ---- rounds ----
  const inRound = (round) => (round ? round.ids.map((id) => players.get(id)).filter((p) => p && p.game && p.game.open) : []);
  function startRound(r, ids, host) {
    const map = modeOf(r.pick), max = MODES[map].max;
    ids = ids.slice(0, max); if (!ids.includes(host)) host = ids[0];
    // each player's name for the round, fixed at the start; two the same get a number
    const look = {}, seen = new Map();
    for (const id of ids) { const n = nameOf(players.get(id).name), k = (seen.get(n) || 0) + 1; seen.set(n, k); look[id] = { name: k > 1 ? n + ' ' + k : n }; }
    const round = r.round = { id: crypto.randomBytes(4).toString('hex'), map, ids, look, host, bots: Math.max(0, max - ids.length), ready: new Set(), begun: 0, at: Date.now() };
    rounds.set(round.id, r);
    log('room ' + r.code + ' (' + r.kind + '): round ' + round.id + ' on ' + map + ' for ' + ids.map((id) => players.get(id).name).join(', ') + ' and ' + round.bots + ' bots');
    for (const id of ids) { const p = players.get(id); if (inLobby(p)) p.lobby.send({ t: 'go', round: round.id, map, bots: round.bots, host: round.host, room: r.code, kind: r.kind }); }
    tellRoom(r);
    // a slow device does not hold everyone up for long: the round starts after this, and it joins when it is ready
    setTimeout(() => { if (r.round === round) maybeBegin(r, true); }, r.kind === 'quick' ? 45000 : 90000).unref();
    return true;
  }
  function maybeBegin(r, force) {
    const round = r.round;
    if (!round || round.begun) return;
    const all = round.ids.every((id) => round.ready.has(id));
    if (!all && !force) return;
    round.begun = Date.now();
    for (const p of inRound(round)) p.game.send({ t: 'begin', in: 1200 });
    log('room ' + r.code + ': round ' + round.id + ' begins');
    tellRoom(r);
  }
  function endRound(r, why) {
    if (!r.round) return;
    log('room ' + r.code + ': round ' + r.round.id + ' over (' + why + ')');
    rounds.delete(r.round.id); r.round = null; r.quiet = Date.now();
    // a quick room is done after its round: "Play again" finds a new one
    if (r.kind === 'quick') dropRoom(r); else tellRoom(r);
  }

  function onText(c, m, text) {
    if (process.env.MMDEBUG && m.t !== 's') console.log('  <-', c.pid || '?', JSON.stringify(m).slice(0, 160));
    const me = c.pid && players.get(c.pid);
    if (m.t === 'hello') {
      const id = String(m.id || '').slice(0, 24); if (!id) return;
      let p = players.get(id);
      if (!p) { p = { id, name: 'Player', joined: Date.now(), room: null }; players.set(id, p); }
      if (m.name) p.name = nameOf(m.name);
      if (typeof m.touch === 'boolean') p.touch = m.touch;
      c.pid = id;
      if (m.where === 'game') {
        if (p.game && p.game !== c) p.game.close();
        p.game = c;
        const r = rounds.get(m.round), round = r && r.round;
        if (!round || round.id !== m.round || !round.ids.includes(id)) { c.send({ t: 'noround' }); return; }
        if (p.room !== r.code) { leaveRoom(p); r.members.set(id, r.members.get(id) || Date.now()); p.room = r.code; }
        c.send({ t: 'welcome', round: round.id, map: round.map, host: round.host, me: id, bots: round.bots, room: r.code, kind: r.kind,
          players: round.ids.map((pid, slot) => ({ id: pid, slot, ...round.look[pid], here: pid === id || !!((players.get(pid) || {}).game && players.get(pid).game.open) })), begun: round.begun ? Date.now() - round.begun : -1 });
        for (const q of inRound(round)) if (q !== p) q.game.send({ t: 'joined', id, name: p.name, ...round.look[id] });
        tellRoom(r);
      } else {
        if (p.lobby && p.lobby !== c) p.lobby.close();
        p.lobby = c;
        if (m.room) join(p, c, m.room);
        else { const r = p.room && rooms.get(p.room); if (r) tellRoom(r); else c.send(hubState()); }
      }
      return;
    }
    if (!me) return;
    if (m.t === 'join' && c === me.lobby) { join(me, c, m.room); return; }
    if (m.t === 'leave' && c === me.lobby) { leaveRoom(me); c.send(hubState()); return; }
    const room = me.room && rooms.get(me.room);
    if (m.t === 'name') { me.name = nameOf(m.name); if (room) tellRoom(room); return; }
    if (room && room.kind !== 'quick' && m.t === 'pick' && me.id === hostOf(room) && !room.round) { room.pick = modeOf(m.map); tellRoom(room); return; }
    if (room && room.kind !== 'quick' && m.t === 'start' && me.id === hostOf(room)) {
      // a round still going (someone still on its results card): it ends for them, and the new one starts
      if (room.round) { const f = frame(JSON.stringify({ t: 'end', from: me.id, ranks: null, next: true })); for (const q of inRound(room.round)) q.game.sendFrame(f); endRound(room, 'a new round'); }
      const ids = here(room).filter(inLobby).map((p) => p.id);
      if (!ids.includes(me.id)) ids.unshift(me.id);
      startRound(room, ids, me.id);
      return;
    }
    const r = room, round = r && r.round;
    if (!round || c !== me.game || !round.ids.includes(me.id)) return;
    // ---- in a round ----
    if (m.t === 'bye') { c.close(); return; }   // Quit in the settings: the same as closing the page, said at once
    if (m.t === 'ready') { round.ready.add(me.id); if (round.begun) c.send({ t: 'begin', in: 0 }); else maybeBegin(r, false); return; }
    if (m.t === 'end' && me.id === round.host) { const f = frame(JSON.stringify({ t: 'end', from: me.id, ranks: m.ranks })); for (const q of inRound(round)) if (q !== me) q.game.sendFrame(f); endRound(r, 'host finished'); return; }
    // passed on as it came, with who sent it added (made once, the same frame for everyone)
    const f = frame(text.replace(/^\s*\{/, '{"from":' + JSON.stringify(me.id) + ','));
    const state = m.t === 's';
    if (typeof m.to === 'string') { const q = players.get(m.to); if (q && q.game && q.game.open && round.ids.includes(q.id)) q.game.sendFrame(f, state); return; }
    for (const q of inRound(round)) if (q !== me) q.game.sendFrame(f, state);
  }
  // a lobby asks for a room: 'quick:<mode>' for quick play, 'new:<mode>' for a friends' room of its own, or a friends'
  // room's code
  function join(p, c, want) {
    want = String(want || '');
    if (want.startsWith('quick')) {
      const mode = modeOf(want.split(':')[1]), cur = p.room && rooms.get(p.room);
      if (cur && cur.kind === 'quick' && cur.pick === mode && !cur.round) { tellRoom(cur); return; }
      const r = quickRoom(mode); if (!r) { c.send({ t: 'busy' }); return; }
      joinRoom(p, r); return;
    }
    if (want.startsWith('new')) {
      const mode = modeOf(want.split(':')[1]), cur = p.room && rooms.get(p.room);
      if (cur && cur.kind === 'friends' && hostOf(cur) === p.id && seats(cur) <= 1) { cur.pick = mode; tellRoom(cur); return; }   // a second tap
      if (rooms.size >= MAX_ROOMS) { c.send({ t: 'busy' }); return; }
      joinRoom(p, makeRoom('friends', mode)); return;
    }
    const code = codeOf(want), r = rooms.get(code);
    if (!r || r.kind !== 'friends') { c.send({ t: 'nosuch', code }); return; }
    if (!joinRoom(p, r)) c.send({ t: 'full', code });
  }
  function onClose(c) {
    const p = c.pid && players.get(c.pid);
    if (!p) return;
    const r = p.room && rooms.get(p.room), round = r && r.round;
    if (round && p.game === c && round.ids.includes(p.id)) {
      // The host left and others are still playing: the round goes on, and the next player in line is the host from here.
      // Their device takes over the bots where they stand (src/net.js 'left').
      const rest = inRound(round), wasHost = p.id === round.host;
      if (wasHost && rest.length) { round.host = round.ids.find((id) => rest.some((q) => q.id === id)); log('room ' + r.code + ': the host left, ' + players.get(round.host).name + ' hosts now'); }
      for (const q of rest) q.game.send({ t: 'left', id: p.id, host: wasHost, now: round.host });
      if (!rest.length) endRound(r, 'everyone left');
    }
    setTimeout(() => { if (r) tellRoom(r); }, 50);
  }

  // A lobby connection says nothing while everyone waits, and a host on the internet drops a connection that stays
  // quiet (Fly.io's does after a minute): a ping every 25 seconds keeps it. Players who left long ago are forgotten,
  // and so are rooms nobody is in.
  const conns = new Set();
  let ticks = 0, last = { ...tally, at: Date.now() };
  setInterval(() => {
    // a browser answers each ping by itself, so a connection silent for 70 seconds is a tablet that went to sleep or
    // lost its wifi without saying goodbye: let it go, so its player leaves the lobby and the round
    for (const c of conns) { if (!c.open) conns.delete(c); else if (Date.now() - c.heard > 70000) { c.close(); conns.delete(c); } else c.ping(); }
    const now = Date.now();
    for (const p of players.values()) {
      if (online(p)) { p.seen = now; continue; }
      const r = p.room && rooms.get(p.room), playing = r && r.round && r.round.ids.includes(p.id);
      if (r && !playing && now - (p.seen || p.joined) > AWAY) leaveRoom(p);
      if (now - (p.seen || p.joined) > 600000 && !playing) { if (p.room) leaveRoom(p); players.delete(p.id); }
    }
    for (const r of [...rooms.values()]) {
      if (r.round && now - r.round.at > ROUND_MAX) endRound(r, 'too long');
      if (r.round) continue;
      if (seats(r)) { r.quiet = now; continue; }
      if (r.kind === 'quick' || now - r.quiet > FRIENDS_KEEP) dropRoom(r);
    }
    tellHub();
    // a line in the log every minute while anyone is on (Fly.io: fly logs), and the same numbers at /stats
    if (++ticks % 2 === 0 && players.size) { const s = stats(); log(`rooms ${s.rooms} (${s.quick} quick, ${s.friends} friends), ${s.online} online, ${s.playing} in rounds; in ${s.inPerSec} msg/s ${s.inKBs} KB/s, out ${s.outPerSec} msg/s ${s.outKBs} KB/s${s.dropped ? ', ' + s.dropped + ' skipped' : ''}`); }
  }, 25000).unref();
  function stats() {
    const now = Date.now(), dt = Math.max(1, now - last.at) / 1000, k = { ...tally };
    const out = { rooms: 0, quick: 0, friends: 0, rounds: rounds.size, online: 0, playing: 0,
      inPerSec: Math.round((k.inMsgs - last.inMsgs) / dt), inKBs: Math.round((k.inBytes - last.inBytes) / dt / 1024), outPerSec: Math.round((k.outMsgs - last.outMsgs) / dt), outKBs: Math.round((k.outBytes - last.outBytes) / dt / 1024), dropped: k.dropped - last.dropped,
      rss: Math.round(process.memoryUsage().rss / 1048576) };
    for (const r of rooms.values()) { out.rooms++; out[r.kind]++; }
    for (const p of players.values()) if (online(p)) { out.online++; if (p.game && p.game.open) out.playing++; }
    last = { ...k, at: now };
    return out;
  }

  server.on('upgrade', (req, sock) => {
    if (!req.url.startsWith('/ws') || !req.headers['sec-websocket-key']) { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    sock.setNoDelay(true);
    conns.add(wrap(sock, onText, onClose));
  });
  return { state: hubState, stats, peek: () => ({ rooms: [...rooms.values()].map((r) => ({ code: r.code, kind: r.kind, seats: seats(r), round: !!r.round })) }) };
}
