import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const EditorPage = lazy(() => import("./pages/EditorPage"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));

const LoadingScreen = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
    <div className="relative flex items-center justify-center">
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
      <div className="absolute h-10 w-10 animate-spin rounded-full border-4 border-purple-500/20 border-b-purple-500 [animation-direction:reverse]" />
    </div>
    <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">Loading workspace</p>
  </div>
);

const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
        <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
        <Route path="/documents/:id" element={user ? <EditorPage /> : <Navigate to="/login" replace />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
