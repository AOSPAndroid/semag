import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter, errorMonitor } from 'node:events';
import { Writable } from 'node:stream';
import { startHostConsole } from '../host-console.js';

const ESC = '\u001b';
const stripAnsi = value => value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
const port = 48123, hostname = 'paris-workstation', addresses = ['10.10.4.22', '192.168.2.18'];
const links = [`http://localhost:${port}`, `http://${hostname}:${port}`, ...addresses.map(address => `http://${address}:${port}`)];

/** A writable TTY with observable backpressure and errors, without a real terminal. */
class Terminal extends EventEmitter {
  constructor({ isTTY = true, columns = 100, rows = 30, failWrites = false, signalOnWrite = null } = {}) {
    super(); this.isTTY = isTTY; this.columns = columns; this.rows = rows;
    this.writable = true; this.writableEnded = false; this.destroyed = false;
    this.chunks = []; this.blocked = false; this.failWrites = failWrites; this.signalOnWrite = signalOnWrite;
  }
  write(chunk) {
    if (this.failWrites) throw new Error('Terminal unavailable');
    this.chunks.push(String(chunk));
    if (this.signalOnWrite) { const signal = this.signalOnWrite; this.signalOnWrite = null; this.emit(signal, new Error('Terminal closed during write')); }
    return !this.blocked;
  }
  resize(columns, rows = this.rows) { this.columns = columns; this.rows = rows; this.emit('resize'); }
  get output() { return this.chunks.join(''); }
}

/** Real Writable error delivery is asynchronous even when _write only has a callback. */
class AsyncTerminal extends Writable {
  constructor({ isTTY = false, columns = 100, rows = 30, failText = null } = {}) {
    super({ highWaterMark: 65536 });
    this.isTTY = isTTY; this.columns = columns; this.rows = rows; this.failText = failText; this.chunks = [];
  }
  _write(chunk, encoding, callback) {
    const value = String(chunk); this.chunks.push(value);
    const failure = this.failText && value.includes(this.failText) ? new Error('Asynchronous terminal failure') : null;
    queueMicrotask(() => callback(failure));
  }
  resize(columns, rows = this.rows) { this.columns = columns; this.rows = rows; this.emit('resize'); }
  get output() { return this.chunks.join(''); }
  flush() { return new Promise(resolve => this.write('', resolve)); }
}

function fixture(options = {}) {
  let time = 0, nextId = 0;
  const intervals = [], clears = [], stream = options.stream ?? new Terminal(options.terminal);
  const setIntervalFn = (callback, delay) => {
    const timer = { id: ++nextId, callback, delay, active: true, unrefs: 0, unref() { this.unrefs++; return this; } };
    intervals.push(timer); return timer;
  };
  const clearIntervalFn = timer => { clears.push(timer); if (timer) timer.active = false; };
  const controller = startHostConsole({ port, hostname, addresses: options.addresses ?? addresses, stream, env: { TERM: 'xterm-256color', ...options.env }, now: () => time, setIntervalFn, clearIntervalFn });
  return { controller, stream, intervals, clears,
    tick(count = 1) { for (let index = 0; index < count; index++) { time += 250; for (const timer of intervals) if (timer.active) timer.callback(); } },
    activeTimers: () => intervals.filter(timer => timer.active) };
}

function assertLinks(output, expected = links) {
  for (const link of expected) assert.ok(output.includes(link), `${link} stays copyable with the actual bound port`);
  assert.equal(output.includes(':3000'), false, 'the fallback port never replaces the actual bound port');
}

for (const [name, settings] of [
  ['redirected output', { terminal: { isTTY: false } }],
  ['TERM=dumb', { env: { TERM: 'dumb' } }],
  ['continuous integration', { env: { CI: '1' } }],
  ['NO_COLOR', { env: { NO_COLOR: '1' } }],
  ['FORCE_COLOR=0', { env: { FORCE_COLOR: '0' } }],
  ['explicit animation opt-out', { env: { SEMAG_NO_ANIMATION: '1' } }],
]) {
  test(`${name} prints plain actual-port links without ANSI controls or timers`, () => {
    const { controller, stream, intervals, tick } = fixture(settings);
    assert.equal(controller.mode, 'plain'); assertLinks(stream.output);
    assert.equal(stream.output.includes(ESC), false); assert.equal(intervals.length, 0);
    const initial = stream.output; tick(20); assert.equal(stream.output, initial);
    controller.stop('Host stopped.'); assert.equal(stream.output.includes(ESC), false);
    assert.match(stream.output, /Host stopped\./);
  });
}

test('a TTY starts one unrefed 250ms timer and emits changing bounded frames', () => {
  const { controller, stream, intervals, tick, activeTimers } = fixture();
  assert.equal(controller.mode, 'animated'); assertLinks(stripAnsi(stream.output));
  assert.equal(intervals.length, 1); assert.equal(intervals[0].delay, 250); assert.equal(intervals[0].unrefs, 1);
  const start = stream.chunks.length; tick(8);
  const frames = stream.chunks.slice(start); assert.ok(frames.length >= 2); assert.ok(new Set(frames).size >= 2, 'the scene actually advances');
  assert.ok(frames.every(frame => frame.length < 16384), 'a scene update remains bounded');
  for (const frame of frames) {
    for (const line of stripAnsi(frame).split('\n')) assert.ok(line.replace(/\r/g, '').length < stream.columns, 'animated rows cannot reach the terminal wrap column');
    for (const link of links) assert.equal(frame.includes(link), false, 'stable connection links are never repainted by animation');
    assert.ok((frame.match(/\u001b\[2K/g) || []).length <= controller.diagnostics.frameRows, 'ticks erase only the owned frame rows');
  }
  assert.ok(frames.length <= 8, 'each timer callback produces at most one write');
  assert.equal(activeTimers().length, 1); assert.equal(intervals.length, 1, 'animation never creates a second timer');
  controller.stop(); assert.equal(activeTimers().length, 0);
});

test('an ordinary 80x24 TTY fits the animated host and five complete LAN links without wrapping', () => {
  const lan = ['10.10.4.22', '192.168.2.18', '172.16.0.9', '192.168.4.8', '10.2.3.4'];
  const expected = [links[0], links[1], ...lan.map(address => `http://${address}:${port}`)];
  const { controller, stream, intervals, tick } = fixture({ terminal: { columns: 80, rows: 24 }, addresses: lan });
  assert.equal(controller.mode, 'animated'); assert.equal(intervals.length, 1);
  const initial = stripAnsi(stream.output); assertLinks(initial, expected);
  assert.ok(initial.split('\n').length - 1 < stream.rows, 'startup reserves a cursor row rather than scrolling the owned frame');
  for (const line of initial.split('\n')) assert.ok(line.length < stream.columns, 'neither the frame nor static links trigger terminal wrapping');
  const start = stream.chunks.length; tick(4);
  for (const chunk of stream.chunks.slice(start)) {
    for (const line of stripAnsi(chunk).split('\n')) assert.ok(line.replace(/\r/g, '').length < stream.columns);
    for (const url of expected) assert.equal(chunk.includes(url), false, 'ticks leave all connection links static');
  }
  controller.stop();
});

test('backpressure skips future writes and draining never flushes a queued frame history', () => {
  const { controller, stream, tick, intervals } = fixture();
  stream.blocked = true; tick(); const blockedAt = stream.chunks.length;
  const frameCount = controller.diagnostics.frameCount;
  tick(200); assert.equal(stream.chunks.length, blockedAt, 'no new buffered writes while the stream is saturated');
  assert.equal(controller.diagnostics.frameCount, frameCount); assert.ok(controller.diagnostics.skippedFrames >= 200);
  stream.blocked = false; stream.emit('drain');
  assert.ok(stream.chunks.length <= blockedAt + 1, 'draining may draw one current frame, never every skipped frame');
  const drainedAt = stream.chunks.length; tick(); assert.equal(stream.chunks.length, drainedAt + 1);
  stream.writableNeedDrain = true; const saturatedAt = stream.chunks.length; tick(4);
  assert.equal(stream.chunks.length, saturatedAt, 'native writableNeedDrain also suppresses buffered frame writes');
  stream.writableNeedDrain = false; stream.emit('drain'); tick(); assert.equal(stream.chunks.length, saturatedAt + 1);
  assert.equal(intervals.length, 1); controller.stop();
});

test('narrow terminal resize ends animation cleanly and keeps full static URLs', () => {
  const { controller, stream, tick, intervals, activeTimers } = fixture(); tick(2);
  const resizeAt = stream.chunks.length; stream.resize(40, 20);
  assert.equal(controller.mode, 'plain'); assert.equal(activeTimers().length, 0);
  const fallback = stripAnsi(stream.chunks.slice(resizeAt).join('')); assertLinks(fallback);
  for (const line of fallback.split('\n')) assert.ok(line.length <= stream.columns, 'plain prose stays compact on a 40-column terminal');
  const rawFallback = stream.chunks.slice(resizeAt).join('');
  assert.equal(/\u001b\[\d*A/.test(rawFallback), false, 'narrow fallback does not try to reclaim reflowed terminal rows');
  assert.equal(rawFallback.includes(`${ESC}[2K`), false, 'narrow output never redraws an overflowing animation');
  const afterResize = stream.output; tick(20); assert.equal(stream.output, afterResize);
  stream.resize(100, 30); assert.equal(intervals.length, 1, 'resize does not restart another animation loop');
  controller.stop();
});

test('stop clears its timer/listeners once, restores the cursor and prints the final status', () => {
  const { controller, stream, tick, intervals, clears, activeTimers } = fixture();
  const externalResize = () => {}; stream.on('resize', externalResize);
  const externalError = () => {}, externalClose = () => {};
  stream.on('error', externalError); stream.on('close', externalClose);
  tick(2); controller.stop('Host shut down.');
  assert.equal(controller.mode, 'stopped'); assert.equal(controller.diagnostics.cursorHidden, false); assert.equal(controller.diagnostics.timerActive, false);
  assert.equal(activeTimers().length, 0); assert.deepEqual(clears, [intervals[0]]);
  assert.ok(stream.output.includes(`${ESC}[?25h`), 'cursor visibility is restored'); assert.match(stripAnsi(stream.output), /Host shut down\./);
  assert.deepEqual(stream.listeners('resize'), [externalResize], 'only the presenter resize listener is removed');
  assert.equal(stream.listenerCount('drain'), 0);
  assert.deepEqual(stream.listeners('error'), [externalError]); assert.deepEqual(stream.listeners('close'), [externalClose]);
  const stopped = stream.output; controller.stop('Duplicate shutdown.'); tick(20); intervals[0].callback(); stream.resize(70, 24); stream.emit('drain');
  assert.equal(stream.output, stopped); assert.deepEqual(clears, [intervals[0]], 'cleanup stays idempotent');
});

test('stream write failure and an emitted writable error cannot block shutdown', () => {
  for (const failure of ['write', 'error']) {
    const { controller, stream, tick, activeTimers } = fixture();
    if (failure === 'write') { stream.failWrites = true; assert.doesNotThrow(() => tick()); }
    else assert.doesNotThrow(() => stream.emit('error', new Error('Detached terminal')));
    assert.equal(activeTimers().length, 0, 'an unavailable stream cannot leave an animation loop running');
    assert.doesNotThrow(() => controller.stop('Stopped despite terminal failure.'));
    assert.equal(activeTimers().length, 0); assert.equal(stream.listenerCount('resize'), 0); assert.equal(stream.listenerCount('drain'), 0);
  }
});

test('copied read-only diagnostics cannot change actual-port links, clock or lifecycle', () => {
  const { controller, stream, tick } = fixture(), first = controller.diagnostics;
  assert.ok(Object.isFrozen(first)); assert.equal(first.mode, 'animated'); assert.equal(first.timerActive, true); assert.equal(first.cursorHidden, true);
  assert.ok(Number.isInteger(first.frameRows) && first.frameRows > 0 && first.frameRows <= stream.rows);
  const urls = first.links.map(link => link.url); for (const url of urls) assert.ok(url.includes(`:${port}`));
  try { first.links[0].url = 'http://wrong-port:3000'; first.frameCount = 90000; } catch { /* Freezing a nested snapshot is also valid. */ }
  assert.deepEqual(controller.diagnostics.links.map(link => link.url), urls);
  tick(4); const next = controller.diagnostics;
  assert.ok(next.frameCount > first.frameCount); assert.ok(Number.isFinite(next.elapsedSeconds) && next.elapsedSeconds >= first.elapsedSeconds);
  controller.stop(); assert.equal(controller.diagnostics.mode, 'stopped');
});

test('an unavailable writer at startup stays synchronous and leaves no active timer or shutdown exception', () => {
  let hosted;
  assert.doesNotThrow(() => { hosted = fixture({ terminal: { failWrites: true } }); });
  assert.equal(hosted.activeTimers().length, 0);
  assert.doesNotThrow(() => hosted.controller.stop('Shutdown after unavailable output.'));
});

test('synchronous close or error during the first write cannot install a post-shutdown timer', () => {
  for (const signalOnWrite of ['close', 'error']) {
    const { controller, stream, intervals, activeTimers, tick } = fixture({ terminal: { signalOnWrite } });
    assert.equal(controller.mode, 'stopped'); assert.equal(activeTimers().length, 0); assert.equal(intervals.length, 0);
    assert.equal(stream.listenerCount('resize'), 0); assert.equal(stream.listenerCount('drain'), 0);
    const stopped = stream.output; tick(20); controller.stop(); assert.equal(stream.output, stopped);
  }
});

for (const path of ['redirected startup', 'resized static fallback', 'final shutdown output']) {
  test(`a real Writable asynchronous error during ${path} is handled without an orphan timer or listeners`, async () => {
    const stream = new AsyncTerminal({ isTTY: path !== 'redirected startup', failText: path === 'redirected startup' ? 'STATUS:' : null });
    const errors = [], externalClose = () => {};
    // errorMonitor observes the real failure without absorbing an otherwise uncaught error.
    stream.on(errorMonitor, error => errors.push(error)); stream.on('close', externalClose);
    const closed = new Promise(resolve => stream.once('close', resolve));
    const { controller, intervals, clears, tick, activeTimers } = fixture({ stream });
    let failureAt = 0;
    if (path === 'redirected startup') {
      assert.equal(controller.mode, 'plain'); assert.equal(intervals.length, 0);
    } else {
      await stream.flush(); assert.equal(controller.mode, 'animated');
      failureAt = stream.chunks.length;
      if (path === 'resized static fallback') {
        stream.failText = 'STATUS:'; stream.resize(40, 20);
        assert.equal(controller.mode, 'plain');
      } else {
        stream.failText = 'STOPPED'; controller.stop('Host shutdown.');
        assert.equal(controller.mode, 'stopped');
      }
      assert.equal(activeTimers().length, 0);
      assert.deepEqual(clears, [intervals[0]], 'the animation timer ends immediately, before async output settles');
    }
    assert.equal(stream.listenerCount('resize'), 0); assert.equal(stream.listenerCount('drain'), 0);
    assert.ok(stream.listenerCount('error') > 0, 'the presenter retains an error guard while writes are pending');
    await closed;
    assert.equal(errors.length, 1); assert.match(errors[0].message, /Asynchronous terminal failure/);
    assert.equal(controller.mode, 'stopped'); assert.equal(activeTimers().length, 0);
    assert.equal(controller.diagnostics.cursorHidden, false);
    assert.equal(stream.listenerCount('error'), 0); assert.deepEqual(stream.listeners('close'), [externalClose], 'only owned lifecycle guards are removed');
    if (path === 'redirected startup') assert.equal(stream.output.includes(ESC), false);
    if (path === 'resized static fallback') {
      const fallback = stream.chunks.slice(failureAt).join('');
      assert.equal(/\u001b\[\d*A/.test(fallback), false); assert.equal(fallback.includes(`${ESC}[2K`), false);
    }
    const stopped = stream.output; controller.stop('Repeated shutdown.'); tick(20);
    assert.equal(stream.output, stopped, 'async failures leave shutdown idempotent and retire future output');
  });
}

test('successful asynchronous shutdown retires its lifecycle guards after pending output settles', async () => {
  for (const isTTY of [false, true]) {
    const stream = new AsyncTerminal({ isTTY }), externalError = () => {}, externalClose = () => {};
    stream.on('error', externalError); stream.on('close', externalClose);
    const { controller, activeTimers, tick } = fixture({ stream });
    await stream.flush(); controller.stop('Clean shutdown.');
    assert.equal(controller.mode, 'stopped'); assert.equal(activeTimers().length, 0);
    assert.equal(stream.listenerCount('resize'), 0); assert.equal(stream.listenerCount('drain'), 0);
    await stream.flush();
    assert.deepEqual(stream.listeners('error'), [externalError]); assert.deepEqual(stream.listeners('close'), [externalClose]);
    assert.match(stripAnsi(stream.output), /Clean shutdown\./);
    if (isTTY) assert.ok(stream.output.includes(`${ESC}[?25h`));
    else assert.equal(stream.output.includes(ESC), false);
    const stopped = stream.output; controller.stop(); tick(20); assert.equal(stream.output, stopped);
    stream.destroy();
  }
});
