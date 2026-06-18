import assert from "node:assert/strict";
import test from "node:test";
import { getFrontendBaseUrl } from "../utils/frontendUrl.js";

const withEnvironment = (values, callback) => {
  const previous = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    FRONTEND_URLS: process.env.FRONTEND_URLS,
  };

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });

  try {
    callback();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
};

test("prefers a deployed HTTPS frontend origin", () => {
  withEnvironment(
    {
      FRONTEND_URL: "http://localhost:5173",
      FRONTEND_URLS: "http://localhost:5173, https://collabify.example.com/",
    },
    () => assert.equal(getFrontendBaseUrl(), "https://collabify.example.com")
  );
});

test("falls back to localhost when no frontend origin is configured", () => {
  withEnvironment(
    { FRONTEND_URL: undefined, FRONTEND_URLS: undefined },
    () => assert.equal(getFrontendBaseUrl(), "http://localhost:5173")
  );
});
