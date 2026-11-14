import mongoose from 'mongoose';
import { config } from './environment.js';
import { logger } from '../utils/logger.js';

let mongoMemoryServer = null;

export const connectDB = async () => {
  try {
    mongoose.connection.on('connected', () => {
      logger.success('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Attempt connecting to the configured URI
    try {
      await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 2000
      });
      return mongoose.connection;
    } catch (directErr) {
      if (config.useInMemoryDb === 'auto' || config.useInMemoryDb === 'true') {
        logger.info('External MongoDB not reached. Initializing in-memory MongoDB for seamless development/testing...');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create({
          binary: {
            version: '7.0.14'
          }
        });
        const memoryUri = mongoMemoryServer.getUri();
        await mongoose.connect(memoryUri);
        logger.success(`In-memory MongoDB started and connected at: ${memoryUri}`);
        return mongoose.connection;
      }
      throw directErr;
    }
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${error.message}`);
    logger.warn('Please ensure MongoDB is running or configure MONGODB_URI in .env');
    if (config.env === 'production') {
      process.exit(1);
    }
  }
};

export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
    }
    logger.info('MongoDB connection closed cleanly');
  } catch (err) {
    logger.error(`Error closing MongoDB connection: ${err.message}`);
  }
};
