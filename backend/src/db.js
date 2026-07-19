import mongoose from 'mongoose';
import { config } from './config.js';
import { log } from './logger.js';

export async function connectDb() {
  mongoose.set('strictQuery', false);
  await mongoose.connect(config.mongoUri);
  log.info(`MongoDB connected: ${config.mongoUri}`);

  mongoose.connection.on('error', (err) => log.error('MongoDB error', err.message));
  mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));
}
