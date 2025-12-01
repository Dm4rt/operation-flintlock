/**
 * Intel Satellite Imagery Fetch Service
 * Reads satellite snapshot from Firestore (one-time read, no listeners)
 */

import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Fetch satellite imagery coordinates from Firestore
 * @param {string} sessionId - The session ID
 * @returns {Promise<object|null>} Snapshot data or null
 */
export async function fetchSatImagery(sessionId) {
  if (!sessionId) {
    console.error('No session ID provided to fetchSatImagery');
    return null;
  }

  try {
    const intelDocRef = doc(db, 'sessions', sessionId, 'intel', 'satImagery');
    const docSnap = await getDoc(intelDocRef);

    if (!docSnap.exists()) {
      console.log('[Intel] No satellite imagery data available');
      return null;
    }

    const data = docSnap.data();
    console.log('[Intel] Fetched sat imagery:', data);

    return {
      satId: data.satId,
      lat: data.lat,
      lon: data.lon,
      altKm: data.altKm,
      timestamp: data.timestamp?.toDate?.() || new Date()
    };
  } catch (error) {
    console.error('Failed to fetch sat imagery:', error);
    return null;
  }
}

/**
 * Request SDA to send satellite snapshot
 * Writes a request flag to Firestore that SDA monitors
 * @param {string} sessionId - The session ID
 */
export async function requestSdaSnapshot(sessionId) {
  console.log('[Intel] Requesting SDA satellite snapshot via Firestore');
  
  try {
    // Write a request flag to Firestore
    const requestRef = doc(db, 'sessions', sessionId, 'intel', 'satImagery');
    await setDoc(requestRef, {
      requestPending: true,
      requestedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('[Intel] Snapshot request written to Firestore');
  } catch (error) {
    console.error('[Intel] Failed to request snapshot:', error);
  }
}

import { setDoc } from 'firebase/firestore';
