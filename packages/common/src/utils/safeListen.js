import { logger } from './logger.js';

/**
 * Wrap server.listen() with EADDRINUSE retry logic.
 * When --watch restarts a process, the old process may not have released the
 * port yet. This helper catches the error, waits, and retries.
 *
 * @param {import('http').Server|import('https').Server} server
 * @param {number} port
 * @param {Function} [onReady]  Called when the port is successfully bound.
 * @param {object}   [opts]
 * @param {number}   [opts.retries=5]     Max retry attempts.
 * @param {number}   [opts.delayMs=1000]  Delay between retries (ms).
 */
export function safeListen(server, port, onReady, opts = {}) {
  const { retries = 5, delayMs = 1000 } = opts;
  let attempts = 0;

  function tryListen() {
    server.listen(port, () => {
      if (onReady) onReady();
    });
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts < retries) {
      attempts++;
      logger.warn(`Port ${port} in use, retry ${attempts}/${retries} in ${delayMs}ms...`);
      setTimeout(() => {
        server.close(() => tryListen());
      }, delayMs);
    } else if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${port} still in use after ${retries} retries. Exiting.`);
      process.exit(1);
    } else {
      logger.error(`Server error: ${err.message}`);
      process.exit(1);
    }
  });

  tryListen();
}
