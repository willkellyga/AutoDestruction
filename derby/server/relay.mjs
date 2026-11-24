// Auto Destruction's lobby and round relay (derby/server/server.mjs serves it at /ws). Copied from Monster Mayhem's
// (playtest/relay.mjs) and changed for cars: rooms are for one of the three modes, and each mode has its own size.
//   - Play online (quick play, one tap): pick a mode, and the server puts you in the fullest open room for it, or makes
//     one. The round is made with the first player in and `go` is sent at once, so the countdown (10 s, the race 15 s so
//     drivers can gather on the grid) runs while each page loads the map. Players who come during it are added to the
//     same round; it starts when the countdown is out and everyone in it has loaded (at once when it is full, and
//     without a device still loading after LOAD_WAIT). In the first JOIN_LATE of an arena or survival round a new
//     player takes over a bot's seat, starting where the bot was, in their own car. Not in a race (Will, 2026-11-24:
//     no taking over bots mid-race): a race takes players only until its countdown is out.
//   - With friends: a room with a four-letter code. Whoever made it hosts: picks the mode and taps Start. The room stays
//     together between rounds until everyone has gone for 10 minutes.
// Bots take every seat nobody fills: the host's device drives them (derby/src/net.js).
// In a round each device drives its own car and sends where it is about 15 times a second; this only passes messages
// on to the others in the same round, it runs none of the game. When the host leaves mid-round the round goes on and the
// next player in hosts (their device takes over the bots).
// A device that drops out of a round keeps its seat for a while (Monster Mayhem's playtests, 2026-11-23: iPad pages die
// for memory a few seconds after a map loads, and reload): the round waits HOLD with nobody on, the host's bots wait
// HANDOVER for it, and the page that comes back gets its seat (with a rejoin key, so nobody else can take it), the
// round's clock, its own score and, if it hosts and lost them, the bots as they were. Ported from Monster Mayhem's
// playtest/relay.mjs (PR 66 and PR 55), with the scores and the bots in Auto Destruction's own shape.
// A small WebSocket server with no dependencies (text frames only, which is all the game sends).
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
// the modes (the game's map ids), with how many cars a round has: players and bots together, and so the most players
// and how long quick play's countdown is (from the first player in)
export const MODES = { arena: { name: 'Arena', max: 8, wait: 10000 }, race: { name: 'Race', max: 6, wait: 15000 }, base: { name: 'Zombie Survival', max: 6, wait: 10000 } };
const MAX_SEATS = 8;      // the most players in a friends' room (a round takes as many as its mode has room for)
const modeOf = (m) => (MODES[m] ? m : 'arena');
const waitOf = (mode) => +process.env.AD_WAIT || MODES[mode].wait;   // quick play's countdown (AD_WAIT: shorter, for the tests)
const QUICK_FULL = 1500;    // ...cut to this once the room is full
const LOAD_WAIT = +process.env.AD_LOAD || 15000;   // after the countdown, a device still loading holds the start this long at most
const JOIN_LATE = +process.env.AD_LATE || 30000;   // an arena or survival round takes a new player into a bot's seat this long after it starts
const FRIENDS_KEEP = 600000;   // a friends' room with nobody in it is kept this long, for whoever comes back
const AWAY = 90000;         // a player gone this long (no lobby, no game page) leaves their room
const MAX_ROOMS = 400;      // more than one small machine could run anyway
const ROUND_MAX = 20 * 60000;   // a round nobody ended (rounds are 2 to 4 minutes, survival can run on) is let go after this
const HOLD = +process.env.AD_HOLD || 30000;          // a round with nobody connected waits this long for someone to come back
const HANDOVER = +process.env.AD_HANDOVER || 10000;  // the host gone this long, and the bots move to another player's device
const AWAY_HAND = +process.env.AD_AWAY || 3000;      // a host whose page went into the background: the bots move this soon
const END_GRACE = 2000;     // a round on a clock (the arena) is ended here this long after the clock runs out, if the host's device has not
const MAX_BOTS = 8;
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
  const born = Date.now();
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
    get age() { return Date.now() - born; },
    why: '',   // why it closed, for the event log: 'closed 1001' (the page said so, with its code), 'gone (no goodbye)', 'silent 70 s', 'replaced', ...
    send(obj) { write(frame(typeof obj === 'string' ? obj : JSON.stringify(obj)), obj && obj.t === 's'); },
    sendFrame: write,
    ping() { if (!closed) try { sock.write(Buffer.from([0x89, 0])); } catch (e) { /* gone */ } },
    close(why) { if (closed) return; closed = true; c.why = c.why || why || 'closed by the server'; try { sock.end(Buffer.from([0x88, 0])); setTimeout(() => sock.destroy(), 2000).unref(); } catch (e) { /* gone */ } onClose(c); },
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
      if (len > 8e6) { c.close('too big'); return; }
      const need = at + (masked ? 4 : 0) + len;
      if (buf.length < need) return;
      let data = buf.subarray(at + (masked ? 4 : 0), need);
      if (masked) { const m = buf.subarray(at, at + 4); data = Buffer.from(data); for (let i = 0; i < data.length; i++) data[i] ^= m[i & 3]; }
      buf = buf.subarray(need);
      if (op === 8) { c.close('closed' + (data.length >= 2 ? ' ' + data.readUInt16BE(0) : '')); return; }
      if (op === 9) { try { sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); } catch (e) { /* gone */ } continue; }
      if (op === 10) continue;
      if (op === 1 || op === 0) {
        parts.push(data);
        if (fin) { const raw = Buffer.concat(parts), text = raw.toString('utf8'); parts = []; tally.inMsgs++; tally.inBytes += raw.length; let m; try { m = JSON.parse(text); } catch (e) { continue; } if (m && typeof m === 'object') onText(c, m, text); }
      }
    }
  });
  // the other end went away: a page that was closed sends a FIN, which on an http server's socket only half-closes it
  sock.on('end', () => { if (!closed) { closed = true; c.why = 'gone (no goodbye)'; try { sock.destroy(); } catch (e) { /* gone */ } onClose(c); } });
  sock.on('close', () => { if (!closed) { closed = true; c.why = 'dropped'; onClose(c); } });
  sock.on('error', (e) => { if (!closed) { closed = true; c.why = 'error ' + ((e && e.code) || ''); onClose(c); } });
  return c;
}

// the lobby and the relay, on an http server's /ws
// event(kind, fields): each thing that happens to a player or a round, as data for the event log (server.mjs keeps it in
// events.jsonl beside the reports): hellos, goodbyes and why, rounds starting and ending, the host handing over
export function attachRelay(server, { log = () => {}, event = () => {} } = {}) {
  const players = new Map();   // id -> { id, key, name, lobby: conn, game: conn, joined, room: code, touch, away }
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
    tellRoom(r); return true;
  }
  // ---- quick play, one tap ----
  // a bot's seat a new player can take: one the host's device last said is still in the round, and nobody has taken
  const freeBot = (round) => round.botList.find((b) => b && b.seat && !b.dead && !round.taken.has(b.seat)) || null;
  // can this room take one more player for this mode now?
  function joinable(r, mode, p, now) {
    if (r.kind !== 'quick' || r.pick !== mode) return false;
    const round = r.round; if (!round) return false;
    if (round.ids.includes(p.id) || round.ids.length >= roomMax(r) || round.bots <= 0) return false;
    if (!round.begun) return mode === 'race' ? now < r.startAt - 1000 : true;   // (a racer has to load in time for the grid)
    if (mode === 'race') return false;   // no taking over a bot mid-race
    return now - round.begun < JOIN_LATE && !!freeBot(round);
  }
  // the open room for this mode with the most players in its round (then the one starting soonest), or a new one
  function quickRoom(mode, p) {
    let best = null; const now = Date.now();
    for (const r of rooms.values()) {
      if (!joinable(r, mode, p, now)) continue;
      const n = r.round.ids.length;
      if (!best || n > best.n || (n === best.n && r.startAt < best.r.startAt)) best = { r, n };
    }
    if (best) return best.r;
    return rooms.size < MAX_ROOMS ? makeRoom('quick', mode) : null;
  }
  // into a quick room: the first player in makes its round (and is sent `go` at once, so the countdown runs while the map
  // loads); one who comes before it starts is added to it; one who comes after takes over a bot
  function quickJoin(p, r) {
    joinRoom(p, r);
    const now = Date.now();
    if (!r.round) {
      r.startAt = now + waitOf(r.pick);
      startRound(r, [p.id], p.id);
      clearTimeout(r.timer); r.timer = setTimeout(() => countedDown(r), waitOf(r.pick));
      return;
    }
    const round = r.round, max = MODES[round.map].max;
    round.ids.push(p.id); round.bots = Math.max(0, max - round.ids.length); round.look[p.id] = { name: uniqueName(round, p.name) };
    const slot = round.ids.length - 1, info = { id: p.id, slot, ...round.look[p.id] };
    if (!round.begun) {
      // the bots are made when the round starts, on the host's device: a computer hosts before a phone or a tablet
      const h = players.get(round.host);
      if (h && h.touch && p.touch === false) { round.host = p.id; const f = frame(JSON.stringify({ t: 'host', now: p.id, from: h.id })); for (const q of inRound(round)) q.game.sendFrame(f); }
      if (round.ids.length >= max) { r.startAt = Math.min(r.startAt, now + QUICK_FULL); clearTimeout(r.timer); r.timer = setTimeout(() => countedDown(r), Math.max(0, r.startAt - now)); }
      for (const q of inRound(round)) q.game.send({ t: 'add', ...info, bots: round.bots });
    } else {
      // late: a bot's seat. Every device takes that bot out; the player's own car starts where it was (welcome.spawn)
      const b = freeBot(round);
      if (b) { round.taken.add(b.seat); round.spawn[p.id] = { x: b.x, z: b.z, yaw: b.yaw }; }
      const f = frame(JSON.stringify({ t: 'seat', bot: b ? b.seat : null, ...info, bots: round.bots }));
      for (const q of inRound(round)) q.game.sendFrame(f);
      log('room ' + r.code + ': ' + p.name + ' takes over ' + (b ? b.name : 'a bot'));
      event('seat', { room: r.code, round: round.id, player: p.id, bot: b ? b.seat : null, afterMs: now - round.begun });
    }
    p.lobby.send(goMsg(r, round));
    tellRoom(r);
  }
  // the countdown is out: the round starts once everyone in it has loaded, or after LOAD_WAIT without the slow ones
  function countedDown(r) {
    r.timer = null;
    const round = r.round; if (!round || round.begun) return;
    round.due = true; maybeBegin(r, false);
    setTimeout(() => { if (r.round === round) maybeBegin(r, true); }, LOAD_WAIT).unref();
  }
  // a name nobody else in the round has (two the same get a number)
  function uniqueName(round, name) {
    const n = nameOf(name), have = new Set(Object.values(round.look).map((l) => l.name));
    if (!have.has(n)) return n;
    for (let k = 2; ; k++) if (!have.has(n + ' ' + k)) return n + ' ' + k;
  }
  const goMsg = (r, round) => ({ t: 'go', round: round.id, map: round.map, bots: round.bots, host: round.host, room: r.code, kind: r.kind });

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
    const round = r.round = { id: crypto.randomBytes(4).toString('hex'), map, ids, look, host, bots: Math.max(0, max - ids.length), ready: new Set(), begun: 0, at: Date.now(),
      len: 0, keep: {}, botList: [], taken: new Set(), spawn: {}, due: r.kind !== 'quick', holdT: null, handT: null, endT: null, clockT: null };
    rounds.set(round.id, r);
    log('room ' + r.code + ' (' + r.kind + '): round ' + round.id + ' on ' + map + ' for ' + ids.map((id) => players.get(id).name).join(', ') + ' and ' + round.bots + ' bots');
    event('round', { room: r.code, kind: r.kind, round: round.id, map, host, bots: round.bots, players: ids.map((id) => ({ player: id, name: look[id].name })) });
    for (const id of ids) { const p = players.get(id); if (inLobby(p)) p.lobby.send(goMsg(r, round)); }
    tellRoom(r);
    // a slow device does not hold everyone up for long: the round starts after this, and it joins when it is ready
    // (quick play: countedDown's LOAD_WAIT after the countdown, and this in case)
    setTimeout(() => { if (r.round === round) maybeBegin(r, true); }, r.kind === 'quick' ? waitOf(map) + LOAD_WAIT + 5000 : 90000).unref();
    return true;
  }
  function maybeBegin(r, force) {
    const round = r.round;
    if (!round || round.begun) return;
    const all = round.ids.every((id) => round.ready.has(id));
    if (!force && (!all || !round.due)) return;
    round.begun = Date.now();
    // (who is in it and how many bots, as it starts: quick play adds players up to here, and the host makes the bots now)
    const roster = { host: round.host, bots: round.bots, players: round.ids.map((pid, slot) => ({ id: pid, slot, ...round.look[pid] })) };
    for (const p of inRound(round)) p.game.send({ t: 'begin', in: 1200, left: clockLeft(round), ...roster });
    // A round on a clock (the arena says how long in its ready) has the server's clock: it ends the round on time even
    // when the host's device has gone, and every few seconds tells each device how long is left (a device's own clock
    // stops while its page is hidden or reloading).
    if (round.len) {
      round.endT = setTimeout(() => {
        if (r.round !== round) return;
        const f = frame(JSON.stringify({ t: 'end', from: 'server' }));
        for (const q of inRound(round)) q.game.sendFrame(f);
        endRound(r, 'time up');
      }, 1200 + round.len * 1000 + END_GRACE);
      round.clockT = setInterval(() => { const f = frame(JSON.stringify({ t: 'clock', left: clockLeft(round) })); for (const q of inRound(round)) q.game.sendFrame(f); }, 5000);
    }
    log('room ' + r.code + ': round ' + round.id + ' begins');
    event('begin', { room: r.code, round: round.id, waitMs: round.begun - round.at, ready: round.ready.size, of: round.ids.length, forced: !!force && round.ready.size < round.ids.length });
    tellRoom(r);
  }
  // milliseconds of play left on the round's clock (0 before it begins, or for a round with no clock)
  const clockLeft = (round) => (round.begun && round.len ? Math.max(0, round.begun + 1200 + round.len * 1000 - Date.now()) : 0);
  // the bots move to the next player in line who is on (not `skip`: the host whose page reloaded and lost them)
  function handOver(r, round, skip) {
    round.handT = null;
    if (r.round !== round) return;
    const cur = players.get(round.host);
    if (!skip && cur && cur.game && cur.game.open && !cur.away) return;   // back in time
    const on = inRound(round).filter((q) => q.id !== skip), rest = on.some((q) => !q.away) ? on.filter((q) => !q.away) : [];   // not to a page that is away too
    if (!rest.length) return;   // nobody to take them: the host keeps them, and its seat waits
    round.host = round.ids.find((id) => rest.some((q) => q.id === id));
    log('room ' + r.code + ': ' + players.get(round.host).name + ' hosts now'); event('host', { room: r.code, round: round.id, from: cur ? cur.id : '', to: round.host });
    const f = frame(JSON.stringify({ t: 'host', now: round.host, from: cur ? cur.id : '' }));
    for (const q of inRound(round)) q.game.sendFrame(f);
  }
  function endRound(r, why) {
    if (!r.round) return;
    { const o = r.round; clearTimeout(o.holdT); clearTimeout(o.handT); clearTimeout(o.endT); clearInterval(o.clockT); }
    log('room ' + r.code + ': round ' + r.round.id + ' over (' + why + ')');
    event('over', { room: r.code, round: r.round.id, why, ms: Date.now() - r.round.at, playedMs: r.round.begun ? Date.now() - r.round.begun : 0 });
    rounds.delete(r.round.id); r.round = null; r.quiet = Date.now();
    // a quick room is done after its round: "Play again" finds a new one
    if (r.kind === 'quick') dropRoom(r); else tellRoom(r);
  }

  function onText(c, m, text) {
    if (process.env.MMDEBUG && m.t !== 's') console.log('  <-', c.pid || '?', JSON.stringify(m).slice(0, 160));
    if (m.t === 'ping') { c.send('{"t":"pong","c":' + (+m.c || 0) + '}'); return; }   // a game page timing its round trip
    const me = c.pid && players.get(c.pid);
    if (m.t === 'hello') {
      const id = String(m.id || '').slice(0, 24); if (!id) return;
      let p = players.get(id);
      // the rejoin key: the device that first used this id keeps it, so nobody else can take the seat by sending the id
      const key = typeof m.key === 'string' ? m.key.slice(0, 40) : '';
      if (p && p.key && key !== p.key) { log('a hello for ' + id + ' with the wrong key, refused'); c.close('wrong key'); return; }
      if (!p) { p = { id, name: 'Player', joined: Date.now(), room: null }; players.set(id, p); }
      if (key && !p.key) p.key = key;
      if (m.name) p.name = nameOf(m.name);
      if (typeof m.touch === 'boolean') p.touch = m.touch;
      c.pid = id; c.where = m.where === 'game' ? 'game' : 'lobby';
      event('hello', { player: id, name: p.name, where: c.where, round: m.where === 'game' ? String(m.round || '').slice(0, 16) : undefined, room: m.room ? String(m.room).slice(0, 12) : undefined, fresh: m.where === 'game' ? !!m.fresh : undefined });
      if (m.where === 'game') {
        if (p.game && p.game !== c) p.game.close('replaced');
        p.game = c; p.away = false;
        const r = rounds.get(m.round), round = r && r.round;
        if (!round || round.id !== m.round || !round.ids.includes(id)) { c.send({ t: 'noround' }); return; }
        if (p.room !== r.code) { leaveRoom(p); r.members.set(id, r.members.get(id) || Date.now()); p.room = r.code; }
        // someone is back: the round is not let go
        clearTimeout(round.holdT); round.holdT = null;
        // The host is back. After a dropped connection (the page kept running) it keeps the bots. A page that reloaded has
        // lost them, so another player who is still on takes them now; with nobody else on, it starts them again from the
        // server's last list of them (below).
        if (id === round.host && round.handT) { clearTimeout(round.handT); round.handT = null; if (m.fresh) handOver(r, round, id); }
        const fresh = !!m.fresh, host = round.host === id;
        c.send({ t: 'welcome', round: round.id, map: round.map, host: round.host, me: id, bots: round.bots, room: r.code, kind: r.kind,
          players: round.ids.map((pid, slot) => ({ id: pid, slot, ...round.look[pid], here: pid === id || !!((players.get(pid) || {}).game && players.get(pid).game.open) })), begun: round.begun ? Date.now() - round.begun : -1,
          left: clockLeft(round), startIn: !round.begun && r.kind === 'quick' ? Math.max(0, r.startAt - Date.now()) : 0, spawn: round.spawn[id],
          // a page that reloaded mid-round: the scores every device last sent (its own among them), and (if it hosts) the bots
          back: fresh && round.begun && Object.keys(round.keep).length ? round.keep : undefined,
          botList: fresh && host && round.begun && round.botList.length ? round.botList : undefined });
        for (const q of inRound(round)) if (q !== p) q.game.send({ t: 'joined', id, name: p.name, ...round.look[id] });
        tellRoom(r);
      } else {
        if (p.lobby && p.lobby !== c) p.lobby.close('replaced');
        p.lobby = c;
        if (m.room) join(p, c, m.room);
        // No room in the address is the menu. The player may still be in a room here (they went home, quit a round, or
        // their "leave" was lost with a dropped connection): take them out, or the lobby state sent back would pull the
        // page into that room again (Monster Mayhem PR 55).
        else { leaveRoom(p); c.send(hubState()); }
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
    if (m.t === 'bye') { c.quit = true; c.close('quit'); return; }   // Leave the round: the same as closing the page, said at once, and meant (no waiting for it)
    // The page went into the background, or came back. Its socket stays open but it stops drawing, so the others would
    // see its car frozen and, if it hosts, every bot stopped (a worker steps a hidden page, but iOS freezes it anyway).
    // The others are told (passed on below); a host away AWAY_HAND hands the bots on, as a dropped one does.
    if (m.t === 'away') {
      me.away = !!m.on;
      if (me.id === round.host) { clearTimeout(round.handT); round.handT = me.away ? setTimeout(() => handOver(r, round), AWAY_HAND) : null; }
    }
    // (len: the seconds on the round's clock, for a mode that has one: the arena)
    if (m.t === 'ready') { if (!round.begun && m.len >= 30 && m.len <= 900) round.len = +m.len; round.ready.add(me.id); if (round.begun) c.send({ t: 'begin', in: 0, left: clockLeft(round) }); else maybeBegin(r, false); return; }
    if (m.t === 'end' && me.id === round.host) { const f = frame(JSON.stringify({ t: 'end', from: me.id, ranks: m.ranks })); for (const q of inRound(round)) if (q !== me) q.game.sendFrame(f); endRound(r, 'host finished'); return; }
    // passed on as it came, with who sent it added (made once, the same frame for everyone)
    const f = frame(text.replace(/^\s*\{/, '{"from":' + JSON.stringify(me.id) + ','));
    const state = m.t === 's';
    // the scores and the bots, kept here so they outlive a device: each device's mode sends its own score as k now and
    // then, and the host the bots as b ({ seat, name, load, x, z, yaw, hp, maxHp, dead, ex })
    if (state) {
      if (m.k !== undefined) round.keep[me.id] = m.k;
      if (me.id === round.host && Array.isArray(m.b)) round.botList = m.b.slice(0, MAX_BOTS);
    }
    if (typeof m.to === 'string') { const q = players.get(m.to); if (q && q.game && q.game.open && round.ids.includes(q.id)) q.game.sendFrame(f, state); return; }
    for (const q of inRound(round)) if (q !== me) q.game.sendFrame(f, state);
  }
  // a lobby asks for a room: 'quick:<mode>' for quick play, 'new:<mode>' for a friends' room of its own, or a friends'
  // room's code
  function join(p, c, want) {
    want = String(want || '');
    if (want.startsWith('quick')) {
      const mode = modeOf(want.split(':')[1]), cur = p.room && rooms.get(p.room);
      // a second tap, or the lobby's connection came back: the same round
      if (cur && cur.kind === 'quick' && cur.pick === mode && cur.round && !cur.round.begun && cur.round.ids.includes(p.id)) { c.send(goMsg(cur, cur.round)); return; }
      const r = quickRoom(mode, p); if (!r) { c.send({ t: 'busy' }); return; }
      quickJoin(p, r); return;
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
    event('bye', { player: p.id, name: p.name, where: c.where || '?', why: c.why || '?', ms: c.age, room: r ? r.code : undefined, round: round && round.ids.includes(p.id) ? round.id : undefined, begun: round ? !!round.begun : undefined });
    if (round && p.game === c && round.ids.includes(p.id)) {
      // Their seat is kept: a page that died and reloaded (or a connection that dropped) comes back into the same round.
      // The host's bots wait HANDOVER for it before another player's device takes them (net.js 'host'); a round with
      // nobody on waits HOLD. Leave the round (bye) is meant: the bots move at once and nothing waits.
      const rest = inRound(round), wasHost = p.id === round.host;
      for (const q of rest) q.game.send({ t: 'left', id: p.id, quit: !!c.quit });
      if (c.quit) { if (wasHost) handOver(r, round, p.id); if (!rest.length) endRound(r, 'everyone left'); }
      else if (wasHost && rest.length) { clearTimeout(round.handT); round.handT = setTimeout(() => handOver(r, round), HANDOVER); log('room ' + r.code + ': the host dropped out, waiting for it'); }
      if (!rest.length && !c.quit) { clearTimeout(round.holdT); round.holdT = setTimeout(() => { if (r.round === round && !inRound(round).length) endRound(r, 'everyone left'); }, HOLD); }
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
    for (const c of conns) { if (!c.open) conns.delete(c); else if (Date.now() - c.heard > 70000) { c.close('silent 70 s'); conns.delete(c); } else c.ping(); }
    const now = Date.now();
    for (const p of players.values()) {
      if (online(p)) { p.seen = now; continue; }
      const r = p.room && rooms.get(p.room), playing = r && r.round && r.round.ids.includes(p.id);
      if (r && !playing && now - (p.seen || p.joined) > AWAY) leaveRoom(p);
      if (now - (p.seen || p.joined) > 600000 && !playing) { if (p.room) leaveRoom(p); players.delete(p.id); }
    }
    for (const r of [...rooms.values()]) {
      if (r.round && now - r.round.at > ROUND_MAX) endRound(r, 'too long');
      // a round nobody is on and nobody's seat is held for (the page that got `go` never loaded it, say): let it go
      if (r.round) { const o = r.round; if (inRound(o).length || o.holdT) o.emptyAt = 0; else if (!o.emptyAt) o.emptyAt = now; else if (now - o.emptyAt > HOLD + LOAD_WAIT) endRound(r, 'nobody came'); }
      if (r.round) continue;
      if (seats(r)) { r.quiet = now; continue; }
      if (r.kind === 'quick' || now - r.quiet > FRIENDS_KEEP) dropRoom(r);
    }
    tellHub();
    // a line in the log every minute while anyone is on (Fly.io: fly logs), and the same numbers at /stats
    if (++ticks % 2 === 0 && players.size) { const s = stats(); event('stats', s); log(`rooms ${s.rooms} (${s.quick} quick, ${s.friends} friends), ${s.online} online, ${s.playing} in rounds; in ${s.inPerSec} msg/s ${s.inKBs} KB/s, out ${s.outPerSec} msg/s ${s.outKBs} KB/s${s.dropped ? ', ' + s.dropped + ' skipped' : ''}`); }
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
