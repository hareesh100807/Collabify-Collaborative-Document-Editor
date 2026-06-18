import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  const databaseUrl = process.env.DB_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "DB_URL is not configured. Create backend/.env from backend/.env.example and add your MongoDB connection string."
    );
  }

  try {
    await mongoose.connect(databaseUrl);
    console.log("DB connected");
    return mongoose.connection;
  } catch (err) {
    throw new Error(`Unable to connect to MongoDB: ${err.message}`, { cause: err });
  }
};

export default connectDB;
