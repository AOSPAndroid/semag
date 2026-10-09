import { performance } from 'node:perf_hooks';

const ESC = '\x1b[';
const RESET = `${ESC}0m`, SHOW_CURSOR = `${ESC}?25h`, HIDE_CURSOR = `${ESC}?25l`;
const CYAN = `${ESC}36m`, AMBER = `${ESC}33m`, PALE = `${ESC}97m`, DIM = `${ESC}90m`;
const MIN_COLUMNS = 80, FRAME_ROWS = 13, FRAME_INTERVAL = 250;
// Five-pixel lowercase forms share a baseline with a full-height capital G.
// Every tile is two ASCII spaces; no codepage-specific block glyph is needed.
const GLYPHS = [
  ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  ['00000', '00000', '01110', '10001', '11111', '10000', '01111'],
  ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
];
const PIXELS = Array.from({ length: 7 }, (_, row) => GLYPHS.map(glyph => glyph[row]).join('0'));
const ascii = value => String(value ?? '').replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
const visibleLength = line => line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').length;

function hostUrl(value, port) {
  const host = String(value ?? '').trim();
  if (!host || /[\x00-\x20\x7f/@\\?#]/.test(host)) return null;
  const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  try {
    const parsed = new URL(`http://${bracketed}:${port}`);
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    // URL canonicalization also turns international hostnames into portable ASCII.
    return `http://${parsed.hostname}:${port}`;
  } catch { return null; }
}

function connectionLinks(port, hostname, addresses) {
  const links = [{ label: 'LOCAL', url: `http://localhost:${port}` }];
  const host = hostUrl(hostname, port);
  if (host) links.push({ label: 'HOST', url: host });
  const seen = new Set(links.map(link => link.url));
  for (const address of Array.isArray(addresses) ? addresses : []) {
    const url = hostUrl(typeof address === 'string' ? address : address?.address, port);
    if (url && !seen.has(url)) { seen.add(url); links.push({ label: 'LAN', url }); }
  }
  return links;
}

function uptime(seconds) {
  const value = Math.max(0, Math.min(359999999, Math.floor(seconds)));
  return `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

/** A bounded terminal ornament for an already listening server. No network polling. */
export function startHostConsole({ port, hostname = 'localhost', addresses = [], stream = process.stdout, env = process.env,
  now = () => performance.now(), setIntervalFn = setInterval, clearIntervalFn = clearInterval } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('Host console needs the actual bound port (1-65535).');
  if (!stream || typeof stream.write !== 'function') throw new TypeError('Host console needs a writable output stream.');
  const links = connectionLinks(port, hostname, addresses);
  const clock = () => { try { const value = now(); return Number.isFinite(value) ? value : 0; } catch { return 0; } };
  const born = clock();
  const elapsed = () => Math.max(0, (clock() - born) / 1000);
  let mode = 'plain', timer = null, cursorHidden = false, stopped = false, blocked = false, writeFailed = false;
  let frameCount = 0, skippedFrames = 0, columns = Number(stream.columns), rows = Number(stream.rows);
  let frameWidth = 0, suffix = [], animationListeners = false, lifecycleListeners = false;
  let pendingWrites = 0, pendingWriteError = false, outputClosed = false;
  const writeCallbacks = typeof stream.writableLength === 'number';

  const write = value => {
    if (stream.destroyed || stream.writableEnded) { writeFailed = true; return false; }
    let settled = false;
    const written = error => {
      if (settled) return;
      settled = true;
      if (outputClosed) return;
      pendingWrites--;
      if (error) {
        // Node emits the corresponding error after its write callbacks. Keep
        // the guard through that event, including final queued shutdown text.
        writeFailed = true; pendingWriteError = true; stop();
      } else if (stopped) removeListeners();
    };
    if (writeCallbacks) pendingWrites++;
    try {
      const accepted = writeCallbacks ? stream.write(value, written) : stream.write(value);
      if (accepted === false) blocked = true;
      return true;
    } catch {
      if (writeCallbacks && !settled) { settled = true; pendingWrites--; }
      writeFailed = true; return false;
    }
  };
  const off = (event, listener) => {
    if (typeof stream.off === 'function') stream.off(event, listener);
    else if (typeof stream.removeListener === 'function') stream.removeListener(event, listener);
  };
  const clearTimer = () => {
    if (timer !== null) { const current = timer; timer = null; clearIntervalFn(current); }
  };
  const removeAnimationListeners = () => {
    if (!animationListeners) return;
    off('resize', onResize); off('drain', onDrain);
    animationListeners = false;
  };
  const removeListeners = () => {
    removeAnimationListeners();
    if (!lifecycleListeners || pendingWrites > 0 || pendingWriteError) return;
    off('error', onError); off('close', onClose);
    lifecycleListeners = false;
  };
  const restoreCursor = () => {
    if (cursorHidden) { cursorHidden = false; write(`${RESET}${SHOW_CURSOR}`); }
  };
  const plain = (status = 'ONLINE') => [
    'semaG - Games, reversed.',
    'Your PC. Your game night.',
    `STATUS: ${status} | Uptime ${uptime(elapsed())}`,
    ...links.flatMap(link => {
      const labeled = `${link.label.padEnd(7)} ${link.url}`;
      return Number.isInteger(Number(stream.columns)) && labeled.length >= Number(stream.columns) ? [link.label, link.url] : [labeled];
    }),
    'Open hub -> create room.',
    'Share its invite with your colleague.',
    'Ctrl+C stops the hub.',
  ].join('\n') + '\n';
  const center = line => ' '.repeat(Math.max(0, Math.floor((frameWidth - 4 - visibleLength(line)) / 2))) + line;
  const framed = line => {
    const width = frameWidth - 4, length = visibleLength(line);
    return `${DIM}|${RESET} ${line}${' '.repeat(Math.max(0, width - length))} ${DIM}|${RESET}`;
  };
  const frame = (status = 'ONLINE') => {
    const highlight = Math.floor(elapsed() * 2) % (PIXELS[0].length + 8) - 4;
    const logo = PIXELS.map((row, y) => {
      let line = '';
      for (let x = 0; x <= row.length; x++) {
        const fill = row[x] === '1', shadow = !fill && y > 0 && PIXELS[y - 1][x - 1] === '1';
        if (!fill) { line += shadow ? `${ESC}100m  ${RESET}` : '  '; continue; }
        const gold = x >= 24, glow = Math.abs(x - highlight) <= 1, edge = y === 0 || PIXELS[y - 1][x] !== '1';
        const base = gold ? 43 : 46, light = gold ? 103 : 106;
        line += `${ESC}${glow || edge ? light : base}m ${ESC}${glow ? light : base}m ${RESET}`;
      }
      return framed(center(line));
    });
    const border = `${DIM}+${'-'.repeat(frameWidth - 2)}+${RESET}`;
    return [border, framed(center(`${PALE}semaG${RESET}  ${DIM}/  GAMES, REVERSED${RESET}`)), framed(''), ...logo,
      framed(center(`${DIM}YOUR PC. YOUR GAME NIGHT.${RESET}`)),
      framed(center(`${status === 'ONLINE' ? CYAN : AMBER}${status}${RESET}  ${DIM}|${RESET}  ${PALE}UPTIME ${uptime(elapsed())}${RESET}`)), border];
  };
  const redraw = status => {
    // The links beneath the ornament are never erased or repainted by ticks.
    const output = `${ESC}${FRAME_ROWS + suffix.length}A\r` + frame(status).map(line => `${ESC}2K${line}\n`).join('') + `${ESC}${suffix.length}B\r`;
    if (write(output)) frameCount++;
  };
  const stop = (message = 'Host stopped.') => {
    if (stopped) return;
    stopped = true;
    clearTimer();
    const wasAnimated = mode === 'animated';
    mode = 'stopped';
    // Restore before a caller prints an error, shutdown reason, or shell prompt.
    restoreCursor();
    if (wasAnimated && !writeFailed && Number(stream.columns) === columns && Number(stream.rows) === rows) redraw('STOPPED');
    const reason = ascii(message);
    if (!writeFailed) write(`\nsemaG STOPPED${reason ? ` - ${reason}` : ''}\n`);
    removeListeners();
  };
  function onDrain() { blocked = false; }
  function onError() { writeFailed = true; pendingWriteError = false; stop(); if (stopped) removeListeners(); }
  function onClose() { outputClosed = true; writeFailed = true; pendingWrites = 0; pendingWriteError = false; stop(); removeListeners(); }
  function onResize() {
    if (stopped || mode !== 'animated' || Number(stream.columns) === columns && Number(stream.rows) === rows) return;
    // Terminal reflow changes row ownership. Retire the ornament permanently
    // instead of guessing where old lines moved or overwriting scrollback.
    clearTimer(); restoreCursor();
    if (stopped) return;
    mode = 'plain'; removeAnimationListeners();
    if (writeFailed || !write(`\n${plain()}`)) stop();
  }

  const disabled = !stream.isTTY || String(env.TERM || '').toLowerCase() === 'dumb' || !!env.CI
    || Object.hasOwn(env, 'NO_COLOR') || String(env.FORCE_COLOR) === '0' || String(env.SEMAG_NO_ANIMATION) === '1';
  if (!disabled && Number.isInteger(columns) && columns >= MIN_COLUMNS && Number.isInteger(rows)) {
    frameWidth = Math.min(96, columns - 2);
    suffix = ['', ...links.flatMap(link => {
      const labeled = `  ${link.label.padEnd(7)} ${link.url}`;
      return labeled.length < columns ? [labeled] : [link.label, link.url];
    }), '  Open hub -> create room -> share invite. Ctrl+C stops the hub.'];
    // Reserve the final cursor row and reject long URLs instead of clipping one.
    if (rows >= FRAME_ROWS + suffix.length + 1 && links.every(link => link.url.length < columns)) mode = 'animated';
  }
  // Redirected logs and a resized static display can also fail asynchronously.
  // These guards stay alive until stop; only the animation listeners retire.
  if (typeof stream.on === 'function') {
    stream.on('error', onError); stream.on('close', onClose); lifecycleListeners = true;
  }
  if (mode === 'animated') {
    if (typeof stream.on === 'function') {
      stream.on('resize', onResize); stream.on('drain', onDrain); animationListeners = true;
    }
    cursorHidden = true;
    if (write(`\n${HIDE_CURSOR}${frame().join('\n')}\n${suffix.join('\n')}\n`) && !stopped && !writeFailed) {
      frameCount++;
      timer = setIntervalFn(() => {
        if (stopped || mode !== 'animated') return;
        if (blocked || stream.writableNeedDrain) { skippedFrames++; return; }
        redraw('ONLINE');
        if (writeFailed) stop();
      }, FRAME_INTERVAL);
      timer?.unref?.();
    } else stop();
  } else if (!write(`\n${plain()}`)) stop();

  return {
    stop,
    get mode() { return mode; },
    get diagnostics() {
      return Object.freeze({ mode, frameCount, skippedFrames, timerActive: timer !== null, cursorHidden, frameRows: mode === 'animated' ? FRAME_ROWS : 0,
        links: Object.freeze(links.map(link => Object.freeze({ ...link }))), elapsedSeconds: Math.floor(elapsed()), pendingWrites });
    },
  };
}
