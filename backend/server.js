import { config } from "dotenv";
import connectDB from './config/db.js';
import app from './app.js';

config();

//connect to db
connectDB();

//start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;