import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (evt) => {
    const { name, value } = evt.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setError("");
    setPending(true);
    const normalizedUsername = form.username.trim().toLowerCase();
    if (!normalizedUsername) {
      setError("Enter a username");
      setPending(false);
      return;
    }
    const trimmedEmail = form.email.trim().toLowerCase();
    try {
      if (mode === "signup") {
        if (!trimmedEmail) {
          setError("Enter an email address");
          setPending(false);
          return;
        }

        const usernameQuery = query(
          collection(db, "users"),
          where("username", "==", normalizedUsername)
        );
        const existing = await getDocs(usernameQuery);
        if (!existing.empty) {
          setError("Username already taken");
          setPending(false);
          return;
        }

        const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, form.password);
        await setDoc(doc(db, "users", credential.user.uid), {
          displayName: form.username,
          username: normalizedUsername,
          email: trimmedEmail,
          role: "cadet",
          createdAt: new Date().toISOString()
        });
      } else {
        const usernameQuery = query(
          collection(db, "users"),
          where("username", "==", normalizedUsername)
        );
        const matches = await getDocs(usernameQuery);
        if (matches.empty) {
          setError("Unknown username");
          setPending(false);
          return;
        }
        const { email } = matches.docs[0].data();
        await signInWithEmailAndPassword(auth, email, form.password);
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-950 to-black" />
      <div className="relative z-10 w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Secure Portal</p>
          <h1 className="text-3xl font-black text-white mt-2">
            {mode === "signup" ? "Create Account" : "Sign In"}
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Authorized cadets and admins only.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-xs uppercase text-slate-400">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-4 py-3 text-white"
                placeholder="you@flintlock"
                required
              />
            </div>
          )}

          <div>
            <label className="text-xs uppercase text-slate-400">Username</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-4 py-3 text-white"
              placeholder="call-sign"
              required
            />
          </div>

          <div>
            <label className="text-xs uppercase text-slate-400">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-4 py-3 text-white"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              pending
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {pending ? "Processing…" : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          {mode === "signup" ? (
            <button onClick={() => setMode("signin")} className="text-blue-300 hover:text-blue-200">
              Have an account? Sign in
            </button>
          ) : (
            <button onClick={() => setMode("signup")} className="text-blue-300 hover:text-blue-200">
              Need an account? Create one
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
