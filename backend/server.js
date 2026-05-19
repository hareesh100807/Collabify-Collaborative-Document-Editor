import { config } from "dotenv";
import connectDB from './config/db.js';
import app from './app.js';
import http from 'http';
import{ Server } from 'socket.io';
import documentSocket from './sockets/documentSocket.js';

config();

//connect to db
connectDB();
const PORT = process.env.PORT || 5000;

//create http server
const server = http.createServer(app);
//create socket server
export const io = new Server(server,{
  cors: {
    origin: "*",
    credentials: true
  },
});

documentSocket(io);
//start server

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


export default app;