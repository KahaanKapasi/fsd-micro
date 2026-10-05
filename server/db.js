import mongoose from 'mongoose';
import fs from 'node:fs';
import { config } from './config.js';

let memoryServer = null;

// Uses MONGO_URI when set; otherwise boots a local persistent mongod (mongodb-memory-server)
// so the project runs with zero setup.
export async function connectDb(uri = config.mongoUri) {
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = new URL('./.data/mongo', import.meta.url).pathname;
    fs.mkdirSync(dbPath, { recursive: true });
    memoryServer = await MongoMemoryServer.create({ instance: { dbPath, port: 27018, storageEngine: 'wiredTiger' } });
    uri = memoryServer.getUri('chatspace');
    console.log(`[db] using embedded MongoDB at ${uri} (set MONGO_URI to use your own)`);
  }
  await mongoose.connect(uri);
  return uri;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  await memoryServer?.stop();
}
