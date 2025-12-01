# Flint File Visibility System

## Overview
The Flint File Visibility System allows administrators to dynamically control which hidden files are visible in the Cyber terminal during operations. Files prefixed with `flint-` are hidden by default and can be revealed in real-time via Firestore.

## How It Works

### 1. File Naming Convention
- Any file starting with `flint-` is treated as a hidden file
- Examples:
  - `flint-secret-key.txt` (hidden by default)
  - `flint-classified.txt` (hidden by default)
  - `notes.txt` (always visible - no prefix)

### 2. Automatic Initialization
When an admin clicks **"Start Operation"** in the Admin Dashboard:
- All `flint-` files are scanned from the manifest
- Firestore documents are created at: `sessions/{sessionId}/terminalFiles/{filename}`
- Each document is initialized with `{ visible: false }`
- This happens automatically - no manual setup required

### 3. Real-Time Visibility Control
Admins can reveal or hide files using the **Flint File Control** panel in the Admin Dashboard:
- Click **"Reveal"** to make a file visible in the terminal
- Click **"Hide"** to hide it again
- Changes take effect **instantly** - players see updates immediately
- No page refresh required

### 4. Terminal Behavior
For players in the Cyber terminal:
- Hidden files do **NOT** appear in `ls` output
- Hidden files **CANNOT** be accessed with `cat`, `cd`, etc.
- Visible files show their full name including the `flint-` prefix
- When revealed, files appear instantly in directory listings

## File Locations

### Source Files
- `/public/terminalFS/home/cadet/flint-secret-key.txt` - Hidden key file
- `/public/terminalFS/mission/briefings/flint-classified.txt` - Hidden briefing
- `/public/terminalFS-manifest.json` - Lists all files to load

### Code Files
- `/src/terminal/initFlintFiles.js` - Initialization & visibility control functions
- `/src/terminal/flintVisibility.js` - Firestore subscription helpers
- `/src/terminal/fsLoader.js` - Loads files and detects `flint-` prefix
- `/src/terminal/fs.js` - Virtual filesystem with visibility filtering
- `/src/components/cmd/FlintFileAdmin.jsx` - Admin UI for toggling visibility

## Firestore Structure

```
sessions/
  ├── FLINT-301/
  │   ├── (session data...)
  │   └── terminalFiles/
  │       ├── flint-secret-key.txt        { visible: false }
  │       └── flint-classified.txt        { visible: false }
  └── FLINT-737/
      └── terminalFiles/
          ├── flint-secret-key.txt        { visible: true }  ← Revealed!
          └── flint-classified.txt        { visible: false }
```

## Admin Workflow

### Starting an Operation
1. Click **"Generate Code"** → Creates session (e.g., `FLINT-301`)
2. Click **"Start Operation"** → Initializes all `flint-` files as hidden
3. Share the code with players
4. Players join and access the Cyber terminal

### Revealing Files During Operation
1. Open **Admin Dashboard**
2. Scroll to **Flint File Control** panel
3. Find the file you want to reveal (e.g., `flint-secret-key.txt`)
4. Click **"Reveal"** button
5. File instantly appears in player terminals

### Hiding Files Again
1. In **Flint File Control** panel
2. Click **"Hide"** button on a visible file
3. File immediately disappears from player terminals

## Adding New Hidden Files

To add a new hidden file to the system:

1. Create the file in `/public/terminalFS/` with `flint-` prefix:
   ```
   /public/terminalFS/mission/briefings/flint-new-clue.txt
   ```

2. Add it to the manifest (`/public/terminalFS-manifest.json`):
   ```json
   {
     "files": [
       ...existing files...,
       {
         "path": "mission/briefings/flint-new-clue.txt",
         "type": "text"
       }
     ]
   }
   ```

3. That's it! Next time an operation starts, it will be automatically initialized as hidden.

## API Functions

### For Admin Use

```javascript
import { initializeFlintFiles, revealFlintFile, hideFlintFile } from '../terminal/initFlintFiles';

// Initialize all flint- files for a session (auto-called on operation start)
await initializeFlintFiles('FLINT-301');

// Reveal a specific file
await revealFlintFile('FLINT-301', 'flint-secret-key.txt');

// Hide a specific file
await hideFlintFile('FLINT-301', 'flint-secret-key.txt');
```

### For Terminal Integration

```javascript
import { subscribeToFlintVisibility } from '../terminal/flintVisibility';

// Subscribe to real-time visibility changes
const unsubscribe = subscribeToFlintVisibility(sessionId, (visibilityMap) => {
  console.log('Visibility updated:', visibilityMap);
  // visibilityMap = { 'flint-secret-key.txt': true, 'flint-classified.txt': false }
});

// Clean up subscription
unsubscribe();
```

## Security Considerations

1. **File Content**: Hidden files are still loaded into the browser - they're just filtered from view. Don't store truly sensitive production data.

2. **Firestore Rules**: Configure Firestore security rules to ensure only admins can modify visibility:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /sessions/{sessionId}/terminalFiles/{filename} {
         allow read: if true;  // Anyone can read visibility state
         allow write: if request.auth != null && request.auth.token.admin == true;
       }
     }
   }
   ```

3. **Client-Side**: All filtering happens client-side. The terminal enforces visibility, but tech-savvy users could theoretically access hidden files by inspecting network requests.

## Troubleshooting

### Files Not Appearing After Reveal
- Check browser console for Firestore errors
- Verify sessionId matches between admin and player
- Confirm Firestore document exists with `visible: true`
- Try refreshing the player's page

### "No flint files initialized" Message
- Click **"Start Operation"** button in Admin Dashboard
- Check browser console for initialization errors
- Verify manifest file is accessible at `/terminalFS-manifest.json`

### Files Still Hidden After Initialization
- This is correct behavior! Files are **initialized as hidden**
- Use the **Flint File Control** panel to reveal them
- Check Firestore Console to verify documents exist
