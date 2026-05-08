/**
 * Minimal STOMP 1.0/1.1 frame parser.
 *
 * Wire format per frame:
 *   COMMAND\n
 *   header1:value1\n
 *   header2:value2\n
 *   \n
 *   body\u0000
 *
 * Parses raw UTF-8 buffers and emits complete frames.
 */

const NULL_BYTE = 0x00;

/**
 * Parse a STOMP frame string into a structured object.
 *
 * @param {string} raw - Single STOMP frame (without trailing null)
 * @returns {{ command: string, headers: Record<string, string>, body: string }}
 */
export function parseFrame(raw) {
  const lines = raw.split('\n');

  // First non-empty line is the command
  let idx = 0;
  while (idx < lines.length && lines[idx].trim() === '') {
    idx++;
  }

  const command = (lines[idx] || '').trim();
  idx++;

  const headers = {};
  while (idx < lines.length) {
    const line = lines[idx];
    idx++;
    if (line.trim() === '') break;

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = unescapeHeader(line.substring(0, colonIdx));
      const value = unescapeHeader(line.substring(colonIdx + 1));
      headers[key] = value;
    }
  }

  // Body is everything after the blank line, up to (but not including) the null byte
  const remaining = lines.slice(idx).join('\n');
  const body = remaining.replace(/\0$/, '');

  return { command, headers, body };
}

/**
 * Serialize a STOMP frame to a string ready for transmission.
 *
 * @param {string} command - STOMP command (CONNECTED, MESSAGE, ERROR, RECEIPT)
 * @param {Record<string, string>} headers
 * @param {string} [body='']
 * @returns {string}
 */
export function serializeFrame(command, headers, body = '') {
  let frame = command + '\n';

  for (const [key, value] of Object.entries(headers)) {
    frame += escapeHeader(key) + ':' + escapeHeader(value) + '\n';
  }

  frame += '\n' + body + '\0';
  return frame;
}

/**
 * Parse a STOMP CONNECT/STOMP frame to extract credentials.
 *
 * @param {string} raw
 * @returns {{ login?: string, passcode?: string, headers: Record<string, string> }}
 */
export function parseConnectFrame(raw) {
  const { command, headers, body } = parseFrame(raw);
  return {
    command,
    login: headers['login'],
    passcode: headers['passcode'],
    headers,
    body,
  };
}

/**
 * Frame accumulator: buffers incoming data and yields complete STOMP frames.
 * Usage:
 *   const acc = new FrameAccumulator();
 *   acc.push(chunk);
 *   while (acc.hasFrames()) { yield acc.nextFrame(); }
 */
export class FrameAccumulator {
  constructor() {
    this._buffer = '';
  }

  /**
   * Append raw data to the internal buffer.
   * @param {string} data
   */
  push(data) {
    this._buffer += data;
  }

  /**
   * @returns {boolean} Whether at least one complete frame is available.
   */
  hasFrames() {
    return this._buffer.includes('\0');
  }

  /**
   * Extract and return the next complete frame.
   * @returns {{ command: string, headers: Record<string, string>, body: string } | null}
   */
  nextFrame() {
    const nullIdx = this._buffer.indexOf('\0');
    if (nullIdx === -1) return null;

    const raw = this._buffer.substring(0, nullIdx);
    this._buffer = this._buffer.substring(nullIdx + 1);
    return parseFrame(raw);
  }
}

// ── Header escaping per STOMP spec ──

function escapeHeader(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/:/g, '\\c');
}

function unescapeHeader(str) {
  return str
    .replace(/\\c/g, ':')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}
