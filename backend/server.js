import express from 'express';
import { config } from 'dotenv';
import connectDB from './config/db.js';
import cors from 'cors';
// Create an Express application
const app = express();

//port number
const PORT = process.env.PORT || 5000;

// Connect to the database
connectDB();

//middleware-->JSON parsing
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

