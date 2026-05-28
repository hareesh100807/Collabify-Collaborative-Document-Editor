import { Routes,Route,Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RegisterPage from "./pages/RegisterPage";
import EditorPage from "./pages/EditorPage";
import InvitePage from "./pages/InvitePage";
import { useAuth } from "./context/AuthContext";
function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <div className="absolute w-10 h-10 border-4 border-emerald-500/20 border-b-emerald-500 rounded-full animate-spin [animation-direction:reverse]"></div>
        </div>
        <p className="mt-6 text-xs font-semibold tracking-widest text-indigo-400 uppercase animate-pulse">
          Loading Workspace...
        </p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />
      <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" />} />
       <Route path="/documents/:id" element={user ? <EditorPage /> : <Navigate to="/login" />} />
       <Route path="/invite/:token" element={<InvitePage />} />
       <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
export default App;