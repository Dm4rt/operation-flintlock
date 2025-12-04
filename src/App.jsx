import { Routes, Route } from "react-router-dom";
import WelcomeScreen from "./pages/WelcomeScreen";
import JoinScreen from "./pages/JoinScreen";
import AdminAccess from "./pages/AdminAccess";
import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";
import AuthPage from "./pages/AuthPage";
import StarBackground from "./components/StarBackground";
import ProtectedRoute from "./components/auth/ProtectedRoute";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      <StarBackground />

      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/"
          element={(
            <ProtectedRoute>
              <WelcomeScreen />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/join/:teamId"
          element={(
            <ProtectedRoute>
              <JoinScreen />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin"
          element={(
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminAccess />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin/control"
          element={(
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin/control/:code"
          element={(
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/dashboard/:teamId/:code"
          element={(
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          )}
        />
      </Routes>
    </div>
  );
}
