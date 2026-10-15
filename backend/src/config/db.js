import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/teamsync';
    console.log(`[MongoDB Connecting]: ${mongoUri}`);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB Connected]: ${conn.connection.host} / ${conn.connection.name}`);

    // Clean legacy stray indexes if present
    try {
      const db = conn.connection.db;
      const ghIndexes = await db.collection('githubintegrations').indexes().catch(() => []);
      if (ghIndexes.some(i => i.name === 'project_id_1')) {
        await db.collection('githubintegrations').dropIndex('project_id_1').catch(() => {});
      }
      const ayIndexes = await db.collection('academicyears').indexes().catch(() => []);
      if (ayIndexes.some(i => i.name === 'year_label_1')) {
        await db.collection('academicyears').dropIndex('year_label_1').catch(() => {});
      }
    } catch {
      // Non-blocking cleanup
    }

    return conn;
  } catch (error) {
    console.error(`[MongoDB Connection Error]: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
