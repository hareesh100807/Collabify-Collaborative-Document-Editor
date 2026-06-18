import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import exp from 'express';
import cookieParser from 'cookie-parser';
import router from './routes/authRoutes.js';
import docRouter from './routes/documentRoutes.js';
import versionRouter from './routes/versionRoutes.js';
import shareRouter from './routes/shareRoutes.js';
//express application
const app = exp();
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
//cors middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
// Keep request parsing below MongoDB's 16 MB document limit.
app.use(exp.json({ limit: "14mb" }));
//cookie parser
app.use(cookieParser());

//routes to handle requests to be written---> app.use()
// app.use("/auth",router)
app.use("/auth",router);
app.use("/documents", docRouter);
app.use("/versions", versionRouter);
app.use("/share", shareRouter);

//to handle invalid path
app.use((req, res, next) => {
  console.log(req.url);
  res.status(404).json({ message: `path ${req.url} is invalid` });
});


//error handling middleware
app.use((err, req, res, next) => {
  console.log("error is ",err)
  console.log("Full error:", JSON.stringify(err, null, 2));
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ message: "Document content is too large" });
  }

  //ValidationError
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: "error occurred", error: err.message });
  }
  //CastError
  if (err.name === "CastError") {
    return res.status(400).json({ message: "error occurred", error: err.message });
  }
  const errCode = err.code ?? err.cause?.code ?? err.errorResponse?.code;
  const keyValue = err.keyValue ?? err.cause?.keyValue ?? err.errorResponse?.keyValue;

  if (errCode === 11000) {
    const field = Object.keys(keyValue)[0];
    const value = keyValue[field];
    return res.status(409).json({
      message: "error occurred",
      error: `${field} "${value}" already exists`,
    });
  }

  //send server side error
  res.status(500).json({ message: "error occurred", error: "Server side error" });
});

// Export app for Vercel serverless
export default app;
