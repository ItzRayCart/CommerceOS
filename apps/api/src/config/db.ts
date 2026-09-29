import mongoose from 'mongoose';

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
}

export async function closeDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export async function pingDatabase(): Promise<void> {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB is disconnected');
  }
  await mongoose.connection.db.admin().ping();
}
