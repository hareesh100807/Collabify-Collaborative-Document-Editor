import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../api/axios";
import { handleShareLink as acceptInviteLink } from "../api/documentService";
import PublicNavbar from "../components/PublicNavbar";
import { useAuth } from "../context/AuthContext.jsx";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();

  const nextUrl = new URLSearchParams(location.search).get("next") || "/dashboard";

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const resolvePendingInvite = async () => {
    const pendingInviteToken = localStorage.getItem("pendingInviteToken");
    if (!pendingInviteToken) return false;

    try {
      const data = await acceptInviteLink(pendingInviteToken);
      localStorage.removeItem("pendingInviteToken");
      navigate(`/documents/${data.documentId}`);
      return true;
    } catch {
      localStorage.removeItem("pendingInviteToken");
      setError("Login succeeded, but the invitation link is invalid or expired.");
      navigate("/dashboard");
      return true;
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      const response = await axiosInstance.post("/auth/login", { email, password });
      setUser(response.data.payload);
      if (await resolvePendingInvite()) return;
      navigate(nextUrl);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Login failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError("");
      const response = await axiosInstance.post("/auth/google", {
        credential: credentialResponse.credential,
      });
      setUser(response.data.payload);
      if (await resolvePendingInvite()) return;
      navigate(nextUrl);
    } catch (err) {
      setError(err.response?.data?.error || "Google login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 text-slate-900">
      <PublicNavbar />

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
          <div className="hidden lg:block">
            <div className="inline-flex rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm">
              Real-time editing, sharing, and autosave
            </div>
            <h1 className="mt-6 max-w-xl text-4xl font-bold tracking-tight text-slate-950">
              Pick up your documents exactly where collaboration happens.
            </h1>
            
          </div>

          <form onSubmit={handleLogin} className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-indigo-950/10 backdrop-blur sm:p-8">
            <div className="mb-7">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Welcome back</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Login to Collabify</h2>
              <p className="mt-2 text-sm text-slate-500">Use your email and password, or continue with Google.</p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  placeholder="Enter your password"
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              Or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="flex justify-center">
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google login failed.")} />
            </div>

            <p className="mt-7 text-center text-sm text-slate-600">
              Don&apos;t have an account?{" "}
              <Link className="font-bold text-indigo-700 hover:text-indigo-900" to="/register">
                Register
              </Link>
            </p>
          </form>
        </section>
      </main>
    </div>
  );
};

export default LoginPage;
