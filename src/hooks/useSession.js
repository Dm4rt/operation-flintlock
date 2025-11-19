import { useEffect, useState, useCallback } from 'react';
import { db } from '../services/firebase';
import {
  doc,
  onSnapshot,
  collection,
  onSnapshot as onCollectionSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  collectionGroup,
  query,
  orderBy,
  addDoc
} from 'firebase/firestore';

export default function useSession(sessionId) {
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (!sessionId) return;
    const ref = doc(db, 'sessions', sessionId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      // normalize Timestamp fields to JS Date for convenience
      if (data && data.startedAt && data.startedAt.toDate) data.startedAt = data.startedAt.toDate();
      setSession(data);
    });
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const coll = collection(db, 'sessions', sessionId, 'participants');
    const q = query(coll, orderBy('joinedAt', 'asc'));
    const unsub = onCollectionSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setParticipants(arr);
    });
    return () => unsub();
  }, [sessionId]);

  const join = useCallback(async (teamId, props = {}) => {
    if (!sessionId) throw new Error('no session id');
    const ref = doc(db, 'sessions', sessionId, 'participants', teamId);
    await setDoc(ref, {
      teamId,
      ...props,
      joinedAt: serverTimestamp()
    });
  }, [sessionId]);

  const leave = useCallback(async (teamId) => {
    if (!sessionId) throw new Error('no session id');
    const ref = doc(db, 'sessions', sessionId, 'participants', teamId);
    try { await updateDoc(ref, { leftAt: serverTimestamp() }); } catch (e) { /* ignore */ }
  }, [sessionId]);

  const update = useCallback(async (patch) => {
    if (!sessionId) throw new Error('no session id');
    const ref = doc(db, 'sessions', sessionId);
    await updateDoc(ref, patch);
  }, [sessionId]);

  const pushInject = useCallback(async (inject) => {
    if (!sessionId) throw new Error('no session id');
    const coll = collection(db, 'sessions', sessionId, 'injects');
    await addDoc(coll, { ...inject, createdAt: serverTimestamp() });
  }, [sessionId]);

  return { session, participants, join, leave, update, pushInject };
}
