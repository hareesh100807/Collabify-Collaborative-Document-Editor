import {BrowserRouter,Routes,Route,} from "react-router";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/register" element={<RegisterPage />} />

        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/dashboard" element={<DashboardPage />} />
 
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;