import { describe, it, expect } from 'vitest';
import { parseFrame, serializeFrame, parseConnectFrame, FrameAccumulator } from '../utils/stomp-parser.js';

describe('stomp-parser', () => {
  describe('parseFrame', () => {
    it('should parse a basic STOMP frame', () => {
      const raw = 'CONNECT\nlogin:user\npasscode:pass\n\n\0';
      const frame = parseFrame(raw);

      expect(frame.command).toBe('CONNECT');
      expect(frame.headers.login).toBe('user');
      expect(frame.headers.passcode).toBe('pass');
      expect(frame.body).toBe('');
    });

    it('should parse frame with body', () => {
      const raw = 'MESSAGE\ndestination:/topic/test\n\nHello World\0';
      const frame = parseFrame(raw);

      expect(frame.command).toBe('MESSAGE');
      expect(frame.headers.destination).toBe('/topic/test');
      expect(frame.body).toBe('Hello World');
    });

    it('should handle escaped headers', () => {
      // STOMP escaping: \c → colon, \n → newline, \\ → backslash
      const raw = 'MESSAGE\nheader1:value\\cwith\\ncolons\n\nbody\0';
      const frame = parseFrame(raw);

      expect(frame.headers.header1).toBe('value:with\ncolons');
    });

    it('should skip leading empty lines', () => {
      const raw = '\n\nCONNECT\nlogin:user\n\n\0';
      const frame = parseFrame(raw);

      expect(frame.command).toBe('CONNECT');
    });
  });

  describe('serializeFrame', () => {
    it('should serialize a basic frame', () => {
      const frame = serializeFrame('CONNECTED', { version: '1.1' });

      expect(frame).toBe('CONNECTED\nversion:1.1\n\n\0');
    });

    it('should serialize frame with body', () => {
      const frame = serializeFrame('MESSAGE', { destination: '/topic/test' }, 'Hello');

      expect(frame).toBe('MESSAGE\ndestination:/topic/test\n\nHello\0');
    });

    it('should escape special characters in headers', () => {
      const frame = serializeFrame('MESSAGE', { key: 'value:with\nspecial\\chars' }, '');

      expect(frame).toContain('key:value\\cwith\\nspecial\\\\chars');
    });
  });

  describe('parseConnectFrame', () => {
    it('should parse CONNECT frame with credentials', () => {
      const raw = 'CONNECT\nlogin:admin\npasscode:secret123\naccept-version:1.1\n\n\0';
      const result = parseConnectFrame(raw);

      expect(result.command).toBe('CONNECT');
      expect(result.login).toBe('admin');
      expect(result.passcode).toBe('secret123');
      expect(result.headers['accept-version']).toBe('1.1');
    });

    it('should handle STOMP frame (alternative CONNECT)', () => {
      const raw = 'STOMP\nlogin:user\npasscode:pass\n\n\0';
      const result = parseConnectFrame(raw);

      expect(result.command).toBe('STOMP');
      expect(result.login).toBe('user');
    });
  });

  describe('FrameAccumulator', () => {
    it('should accumulate and yield complete frames', () => {
      const acc = new FrameAccumulator();

      acc.push('CONNECT\nlogin:user\n');
      expect(acc.hasFrames()).toBe(false);

      acc.push('passcode:pass\n\n\0');
      expect(acc.hasFrames()).toBe(true);

      const frame = acc.nextFrame();
      expect(frame.command).toBe('CONNECT');
      expect(frame.login).toBeUndefined(); // parseFrame doesn't extract login
      expect(frame.headers.login).toBe('user');
    });

    it('should handle multiple frames in buffer', () => {
      const acc = new FrameAccumulator();

      acc.push('CONNECT\nlogin:user\n\n\0MESSAGE\ndestination:/test\n\nbody\0');

      expect(acc.hasFrames()).toBe(true);
      const frame1 = acc.nextFrame();
      expect(frame1.command).toBe('CONNECT');

      expect(acc.hasFrames()).toBe(true);
      const frame2 = acc.nextFrame();
      expect(frame2.command).toBe('MESSAGE');
      expect(frame2.body).toBe('body');

      expect(acc.hasFrames()).toBe(false);
      expect(acc.nextFrame()).toBeNull();
    });

    it('should return null when no complete frames available', () => {
      const acc = new FrameAccumulator();
      expect(acc.nextFrame()).toBeNull();
    });
  });
});
