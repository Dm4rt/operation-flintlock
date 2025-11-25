import { Routes, Route } from "react-router-dom";
import WelcomeScreen from "./pages/WelcomeScreen";
import JoinScreen from "./pages/JoinScreen";
import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";
import SdrAdminPage from "./pages/SdrAdminPage";
import StarBackground from "./components/StarBackground";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      <StarBackground />

      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/join/:teamId" element={<JoinScreen />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/dashboard/:teamId/:code" element={<UserDashboard />} />
        <Route path="/dashboard/ew/:operationId" element={<SdrAdminPage />} />
      </Routes>
    </div>
  );
}
