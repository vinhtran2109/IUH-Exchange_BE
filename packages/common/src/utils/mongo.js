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
  try {
    await mongoose.connect(uri || config.mongodb.uri, {
      // Mongoose 8 defaults are fine
    });
    logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    logger.error('MongoDB connection failed:', err);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}
