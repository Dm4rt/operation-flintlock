import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function SignOutButton({ className = "" }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Failed to sign out", error);
    } finally {
      navigate("/auth", { replace: true });
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className={`px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-sm font-semibold text-slate-200 hover:bg-slate-900 ${className}`}
    >
      Sign Out
    </button>
  );
}
