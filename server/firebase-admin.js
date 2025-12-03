/**
 * Firebase Admin SDK Configuration
 * Hybrid: Uses Env Var on Render, Local File on Dev
 */

import admin from 'firebase-admin';
import { readFile } from 'fs/promises'; // Import file reading capability

let serviceAccount;

try {
  // 1. PROD: Check if the Render Environment Variable exists
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } 
  // 2. DEV: If not, fallback to reading the local file
  else {
    // 'import.meta.url' gets the current directory of this file
    // Ensure 'serviceAccountKey.json' matches your actual filename
    const localKeyPath = new URL('./service-account.json', import.meta.url);
    
    // Use await (Top-level await is supported in ES Modules)
    const fileContent = await readFile(localKeyPath, 'utf-8');
    serviceAccount = JSON.parse(fileContent);
  }

} catch (err) {
  console.error('\n❌ Firebase Admin failed to load service account JSON');
  console.error('Make sure FIREBASE_SERVICE_ACCOUNT is set (Render) or serviceAccountKey.json exists (Local)\n');
  console.error(err);
  process.exit(1); // Stop server if credentials are missing
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Use optional chaining just in case project_id is missing in a malformed JSON
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  });
}

export { admin };
export const db = admin.firestore();
export const auth = admin.auth();