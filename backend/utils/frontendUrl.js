const splitOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const getFrontendBaseUrl = () => {
  const origins = [
    ...splitOrigins(process.env.FRONTEND_URL),
    ...splitOrigins(process.env.FRONTEND_URLS),
  ];

  const deployedOrigin = origins.find((origin) => /^https:\/\//i.test(origin) && !origin.includes("localhost"));
  const selectedOrigin = deployedOrigin || origins[0] || "http://localhost:5173";

  return selectedOrigin.replace(/\/+$/, "");
};
