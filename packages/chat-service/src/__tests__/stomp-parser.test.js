import { describe, it, expect } from 'vitest';
import { parseFrame, serializeFrame, parseConnectFrame, FrameAccumulator } from '../utils/stomp-parser.js';

describe('chat-service stomp-parser', () => {
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
      expect(frame.body).toBe('Hello World');
    });
  });

  describe('serializeFrame', () => {
    it('should serialize a frame', () => {
      const frame = serializeFrame('CONNECTED', { version: '1.1' });
      expect(frame).toBe('CONNECTED\nversion:1.1\n\n\0');
    });
  });

  describe('parseConnectFrame', () => {
    it('should parse CONNECT credentials', () => {
      const raw = 'CONNECT\nlogin:admin\npasscode:secret\n\n\0';
      const result = parseConnectFrame(raw);
      expect(result.login).toBe('admin');
      expect(result.passcode).toBe('secret');
    });
  });

  describe('FrameAccumulator', () => {
    it('should accumulate and yield complete frames', () => {
      const acc = new FrameAccumulator();
      acc.push('CONNECT\nlogin:user\n\n\0');
      expect(acc.hasFrames()).toBe(true);
      const frame = acc.nextFrame();
      expect(frame.command).toBe('CONNECT');
    });

    it('should handle partial frames', () => {
      const acc = new FrameAccumulator();
      acc.push('CONNECT\nlogin:user\n');
      expect(acc.hasFrames()).toBe(false);
      expect(acc.nextFrame()).toBeNull();
    });
  });
});
