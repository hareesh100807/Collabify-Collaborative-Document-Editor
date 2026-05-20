import {BrowserRouter,Routes,Route} from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import ProtectedRoute from "./ProtectedRoutes";
import EditorPage from "../pages/EditorPage";
const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/register" element={<RegisterPage />} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />

        <Route path="/document/:id" element={
          <ProtectedRoute>
            <EditorPage />
          </ProtectedRoute>
        } />

      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;