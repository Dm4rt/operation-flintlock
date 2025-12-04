import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ADMIN_ICON } from '../utils/constants';
import { db } from '../services/firebase';
import SignOutButton from '../components/auth/SignOutButton';

export default function AdminAccess() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const normalizedCode = accessCode.trim().toUpperCase();

  const handleHost = () => {
    navigate('/admin/control');
  };

  const handleJoin = async () => {
    if (!normalizedCode) {
      setError('Enter a valid access key');
      return;
    }

    try {
      setIsChecking(true);
      setError('');
      const sessionRef = doc(db, 'sessions', normalizedCode);
      const snapshot = await getDoc(sessionRef);
      if (!snapshot.exists()) {
        setError('No session found for that key');
        return;
      }
      navigate(`/admin/control/${normalizedCode}`);
    } catch (err) {
      console.error('Failed to validate session code:', err);
      setError('Unable to verify access key right now');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="relative z-20 flex flex-col items-center py-16 px-4 max-w-5xl mx-auto w-full">
      <div className="absolute top-6 right-6">
        <SignOutButton />
      </div>
      <div className="text-center mb-10">
        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Admin Access</p>
        <h1 className="text-4xl md:text-5xl font-black text-white mt-3">Admin Options</h1>
        <p className="text-slate-400 mt-3 max-w-2xl mx-auto">
          Host a brand new operation or rejoin an existing one by entering its access key.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <div className="flex flex-col items-center p-8 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-lg shadow-slate-900/30">
          <div className="p-4 bg-slate-800 rounded-full border border-slate-700 mb-4">
            <ADMIN_ICON className="w-12 h-12 text-slate-100" />
          </div>
          <p className="text-sm uppercase tracking-[0.3em] text-blue-400 mb-2">Host</p>
          <h2 className="text-2xl font-bold text-white">Start New Operation</h2>
          <p className="text-sm text-slate-400 mt-3 text-center">
            Generate a fresh session code, initialize flint files, and broadcast a new mission timer.
          </p>
          <button
            onClick={handleHost}
            className="mt-8 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            Host New Game
          </button>
        </div>

        <div className="flex flex-col p-8 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-lg shadow-slate-900/30">
          <p className="text-sm uppercase tracking-[0.3em] text-purple-400 mb-4">Rejoin</p>
          <h2 className="text-2xl font-bold text-white">Join Existing Operation</h2>
          <p className="text-sm text-slate-400 mt-2">
            Enter the previously issued access key to sync back into an active scenario.
          </p>

          <label className="text-xs uppercase text-blue-400 mt-6">Enter Access Key</label>
          <input
            type="text"
            value={accessCode}
            onChange={(e) => {
              setAccessCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="FLINT-123"
            className="mt-2 w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-center tracking-[0.35em] text-lg"
          />

          {error && (
            <p className="text-sm text-rose-400 mt-2 text-center">{error}</p>
          )}

          <button
            onClick={handleJoin}
            disabled={isChecking}
            className={`mt-6 w-full py-3 rounded-xl font-semibold ${
              isChecking
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isChecking ? 'Checking…' : 'Uplink'}
          </button>

          <button
            onClick={() => navigate('/')}
            className="text-xs text-slate-500 hover:text-slate-300 uppercase tracking-[0.3em] mt-4"
          >
            Abort
          </button>
        </div>
      </div>
    </div>
  );
}
