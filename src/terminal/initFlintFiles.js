/**
 * Initialize Flint Files in Firestore
 * Automatically creates Firestore documents for all flint- prefixed files
 * when an operation starts, setting them to hidden by default.
 */

import { db } from '../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Get all flint- prefixed files from the manifest
 * @returns {Promise<string[]>} Array of flint- filenames
 */
async function getFlintFilesFromManifest() {
  try {
    const response = await fetch('/terminalFS-manifest.json');
    const manifest = await response.json();
    
    const flintFiles = manifest.files
      .map(file => file.path.split('/').pop()) // Get just the filename
      .filter(filename => filename.startsWith('flint-'));
    
    return flintFiles;
  } catch (error) {
    console.error('Failed to load manifest for flint files:', error);
    return [];
  }
}

/**
 * Initialize all flint- files in Firestore for a session
 * Sets visible: false by default for all flint- prefixed files
 * @param {string} sessionId - The session ID
 * @returns {Promise<void>}
 */
export async function initializeFlintFiles(sessionId) {
  if (!sessionId) {
    console.warn('No sessionId provided to initializeFlintFiles');
    return;
  }

  try {
    console.log(`Initializing flint- files for session: ${sessionId}`);
    
    // Get all flint- files from manifest
    const flintFiles = await getFlintFilesFromManifest();
    
    if (flintFiles.length === 0) {
      console.log('No flint- files found in manifest');
      return;
    }

    console.log(`Found ${flintFiles.length} flint- files:`, flintFiles);

    // Initialize each flint- file in Firestore with visible: false
    const promises = flintFiles.map(async (filename) => {
      const fileRef = doc(db, 'sessions', sessionId, 'terminalFiles', filename);
      
      // Check if document already exists
      const fileDoc = await getDoc(fileRef);
      
      if (!fileDoc.exists()) {
        // Only create if it doesn't exist (don't overwrite existing visibility state)
        await setDoc(fileRef, {
          visible: false,
          initializedAt: new Date().toISOString()
        });
        console.log(`Initialized ${filename} as hidden`);
      } else {
        console.log(`${filename} already exists, skipping initialization`);
      }
    });

    await Promise.all(promises);
    console.log(`Flint files initialization complete for session ${sessionId}`);
    
  } catch (error) {
    console.error('Failed to initialize flint files:', error);
  }
}

/**
 * Reveal (unhide) a specific flint- file
 * @param {string} sessionId - The session ID
 * @param {string} filename - The filename (e.g., "flint-secret-key.txt")
 * @returns {Promise<void>}
 */
export async function revealFlintFile(sessionId, filename) {
  if (!sessionId || !filename) {
    console.warn('Missing sessionId or filename');
    return;
  }

  try {
    const fileRef = doc(db, 'sessions', sessionId, 'terminalFiles', filename);
    await setDoc(fileRef, { visible: true }, { merge: true });
    console.log(`Revealed flint file: ${filename}`);
  } catch (error) {
    console.error(`Failed to reveal flint file ${filename}:`, error);
  }
}

/**
 * Hide a specific flint- file
 * @param {string} sessionId - The session ID
 * @param {string} filename - The filename (e.g., "flint-secret-key.txt")
 * @returns {Promise<void>}
 */
export async function hideFlintFile(sessionId, filename) {
  if (!sessionId || !filename) {
    console.warn('Missing sessionId or filename');
    return;
  }

  try {
    const fileRef = doc(db, 'sessions', sessionId, 'terminalFiles', filename);
    await setDoc(fileRef, { visible: false }, { merge: true });
    console.log(`Hidden flint file: ${filename}`);
  } catch (error) {
    console.error(`Failed to hide flint file ${filename}:`, error);
  }
}
