import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Connect to MongoDB.
 * Mỗi service gọi hàm này với dbName riêng.
 *
 * @param {string} uri - MongoDB connection URI
 */
export async function connectMongo(uri) {
  const connectionUri = uri || config.mongodb.uri;
  
  // Try primary connection URI first
  try {
    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    setupConnectionEvents();
    return;
  } catch (err) {
    logger.error(`Primary MongoDB connection failed: ${err.message || err.stack || err}`);
  }

  // Extract database name from connectionUri for local fallback
  let dbName = 'iuh_exchange';
  if (connectionUri) {
    try {
      const parsedUrl = new URL(connectionUri);
      dbName = parsedUrl.pathname.replace(/^\//, '') || 'iuh_exchange';
    } catch (parseErr) {
      const match = connectionUri.match(/\/([^?\/]+)(?:\?|$)/);
      if (match) {
        dbName = match[1];
      }
    }
  }

  const rootUser = process.env.MONGO_ROOT_USER || 'root';
  const rootPassword = process.env.MONGO_ROOT_PASSWORD || 'iuh_exchange_root';

  // Fallback 1: Local MongoDB on standard port without auth (127.0.0.1:27017)
  const fallbackUriNoAuth = `mongodb://127.0.0.1:27017/${dbName}`;
  logger.warn(`Attempting fallback to local MongoDB without auth on 127.0.0.1:27017 (db: ${dbName})...`);
  try {
    await mongoose.connect(fallbackUriNoAuth, {
      serverSelectionTimeoutMS: 3000,
    });
    logger.info(`MongoDB connected to local fallback (no-auth): ${mongoose.connection.host}/${mongoose.connection.name}`);
    setupConnectionEvents();
    return;
  } catch (err) {
    logger.error(`Local fallback without auth on 127.0.0.1:27017 failed: ${err.message || err}`);
  }

  // Fallback 2: Local MongoDB on standard port with root credentials (127.0.0.1:27017)
  const fallbackUriHost1 = `mongodb://${rootUser}:${rootPassword}@127.0.0.1:27017/${dbName}?authSource=admin`;
  logger.warn(`Attempting fallback to local MongoDB with auth on 127.0.0.1:27017 (db: ${dbName})...`);
  try {
    await mongoose.connect(fallbackUriHost1, {
      serverSelectionTimeoutMS: 3000,
    });
    logger.info(`MongoDB connected to local fallback (auth): ${mongoose.connection.host}/${mongoose.connection.name}`);
    setupConnectionEvents();
    return;
  } catch (err) {
    logger.error(`Local fallback with auth on 127.0.0.1:27017 failed: ${err.message || err}`);
  }

  // Fallback 3: Alternative local MongoDB without auth on port 27018
  const fallbackUriNoAuth2 = `mongodb://127.0.0.1:27018/${dbName}`;
  logger.warn(`Attempting fallback to local MongoDB without auth on 127.0.0.1:27018 (db: ${dbName})...`);
  try {
    await mongoose.connect(fallbackUriNoAuth2, {
      serverSelectionTimeoutMS: 3000,
    });
    logger.info(`MongoDB connected to local fallback (no-auth 27018): ${mongoose.connection.host}/${mongoose.connection.name}`);
    setupConnectionEvents();
    return;
  } catch (err) {
    logger.error(`Local fallback without auth on 127.0.0.1:27018 failed: ${err.message || err}`);
  }

  // Fallback 4: Alternative local MongoDB with root credentials on port 27018
  const fallbackUriHost2 = `mongodb://${rootUser}:${rootPassword}@127.0.0.1:27018/${dbName}?authSource=admin`;
  logger.warn(`Attempting fallback to local MongoDB with auth on 127.0.0.1:27018 (db: ${dbName})...`);
  try {
    await mongoose.connect(fallbackUriHost2, {
      serverSelectionTimeoutMS: 3000,
    });
    logger.info(`MongoDB connected to local fallback (auth 27018): ${mongoose.connection.host}/${mongoose.connection.name}`);
    setupConnectionEvents();
    return;
  } catch (err) {
    logger.error(`Local fallback with auth on 127.0.0.1:27018 failed: ${err.message || err}`);
  }

  // Fallback 5: Internal Docker network without auth (mongodb:27017)
  const fallbackUriDockerNoAuth = `mongodb://mongodb:27017/${dbName}`;
  logger.warn(`Attempting fallback to Docker MongoDB without auth on mongodb:27017 (db: ${dbName})...`);
  try {
    await mongoose.connect(fallbackUriDockerNoAuth, {
      serverSelectionTimeoutMS: 3000,
    });
    logger.info(`MongoDB connected to Docker fallback (no-auth): ${mongoose.connection.host}/${mongoose.connection.name}`);
    setupConnectionEvents();
    return;
  } catch (err) {
    logger.error(`Docker fallback without auth on mongodb:27017 failed: ${err.message || err}`);
  }

  // Fallback 6: Internal Docker network with root credentials (mongodb:27017)
  const fallbackUriDocker = `mongodb://${rootUser}:${rootPassword}@mongodb:27017/${dbName}?authSource=admin`;
  logger.warn(`Attempting fallback to Docker MongoDB with auth on mongodb:27017 (db: ${dbName})...`);
  try {
    await mongoose.connect(fallbackUriDocker, {
      serverSelectionTimeoutMS: 3000,
    });
    logger.info(`MongoDB connected to Docker fallback (auth): ${mongoose.connection.host}/${mongoose.connection.name}`);
    setupConnectionEvents();
    return;
  } catch (err) {
    logger.error(`Docker fallback with auth on mongodb:27017 failed: ${err.message || err}`);
    logger.error('All MongoDB connection attempts failed. Exiting...');
    process.exit(1);
  }
}

function setupConnectionEvents() {
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}
