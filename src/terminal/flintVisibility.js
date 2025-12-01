/**
 * Flint Visibility Manager
 * Manages visibility of prefix-based hidden files (flint-*) via Firestore
 */

import { db } from '../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

/**
 * Subscribe to visibility changes for flint- prefixed files in a session
 * @param {string} sessionId - The session ID
 * @param {function} onUpdate - Callback when visibility map updates
 * @returns {function} Unsubscribe function
 */
export function subscribeToFlintVisibility(sessionId, onUpdate) {
  if (!sessionId) {
    console.warn('No sessionId provided to flint visibility');
    onUpdate({});
    return () => {};
  }

  const terminalFilesRef = collection(db, 'sessions', sessionId, 'terminalFiles');

  const unsubscribe = onSnapshot(
    terminalFilesRef,
    (snapshot) => {
      const visibilityMap = {};
      
      console.log(`[FlintVis] Snapshot received for ${sessionId}:`, snapshot.size, 'documents');
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`[FlintVis] - ${doc.id}: visible=${data.visible}`);
        // doc.id is the filename, e.g., "flint-secret.txt"
        visibilityMap[doc.id] = data.visible === true;
      });

      console.log('[FlintVis] Final visibility map:', visibilityMap);
      onUpdate(visibilityMap);
    },
    (error) => {
      console.error('Error subscribing to flint visibility:', error);
      onUpdate({});
    }
  );

  return unsubscribe;
}

/**
 * Check if a filename represents a hidden file (starts with "flint-")
 * @param {string} filename - The filename to check
 * @returns {boolean} True if filename starts with "flint-"
 */
export function isFlintFile(filename) {
  return filename.startsWith('flint-');
}

/**
 * Determine if a flint- file should be visible
 * @param {string} filename - The filename
 * @param {Object} visibilityMap - Map of filenames to visibility
 * @returns {boolean} True if visible
 */
export function isFlintVisible(filename, visibilityMap) {
  return visibilityMap[filename] === true;
}
