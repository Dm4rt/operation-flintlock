# Real Filesystem Terminal System

## Overview

The terminal system now supports **real local filesystem** using actual folders and files inside `/public/terminalFS`, while maintaining **backward compatibility** with the existing JSON-based filesystem.

## Architecture

### 1. Real Filesystem Source (`/public/terminalFS/`)

All files placed in this directory are automatically loaded and made available in the terminal:

```
/public/terminalFS/
├── home/
│   └── cadet/
│       ├── notes.txt          (visible)
│       └── clue1.txt          (hidden by default)
├── mission/
│   ├── briefings/
│   │   └── operation_overview.txt
│   └── inbox/
│       └── encrypted.dat      (hidden by default)
├── logs/
│   ├── system.log
│   └── network.log
└── tools/
    └── README.txt
```

### 2. Filesystem Loader (`/src/terminal/fsLoader.js`)

Uses Vite's `import.meta.glob()` to automatically load all files:

- **Text files**: `.txt`, `.log`, `.dat`, `.md`, `.json`, `.sh` - content loaded as strings
- **Image files**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg` - URLs provided for display

When you add or remove files in `/public/terminalFS/` and restart Vite, they automatically appear in the terminal.

### 3. Visibility System (`/src/terminal/visibility.json`)

Controls which files/folders are visible to terminal users:

```json
{
  "home/cadet/notes.txt": true,       // Visible
  "home/cadet/clue1.txt": false,      // Hidden
  "mission/inbox": false,              // Entire directory hidden
  "mission/inbox/encrypted.dat": false
}
```

**Rules:**
- Paths are relative to `/public/terminalFS/`
- If a parent directory is hidden, all children are hidden
- Default: Files are **visible** unless explicitly set to `false`
- Use this to create progression-based content reveals

### 4. Virtual Filesystem (`/src/terminal/fs.js`)

Extended `VirtualFS` class now supports two modes:

**Legacy Mode** (JSON):
```javascript
const fs = new VirtualFS(jsonData, false);
```

**Real Filesystem Mode** (new):
```javascript
const fsRoot = await loadFilesystem();
const fs = new VirtualFS(fsRoot, true);
```

Key features:
- Automatic visibility filtering
- Full path resolution (`.`, `..`, `~`)
- Image file URL support
- Maintains all existing command compatibility

### 5. Updated Commands

All existing commands work seamlessly with the new system:

#### `ls` - List directory contents
```bash
ls              # Only shows visible files
ls -l           # Detailed listing with colors
ls mission      # List specific directory
```

#### `cd` - Change directory
```bash
cd mission      # Navigate to visible directory
cd ..           # Go up one level
cd ~            # Return to home
```

#### `cat` - Display file contents
```bash
cat notes.txt           # Show text file
cat image.png           # Show image URL
cat file1.txt file2.txt # Multiple files
```

#### Other commands
- `pwd` - Print working directory
- `echo` - Echo text
- `clear` - Clear terminal
- `help` - Show available commands
- `whoami` - Current user
- `uname` - System info

## Usage Guide

### Adding New Content

1. **Add a text file:**
   ```bash
   echo "Secret intel" > /public/terminalFS/mission/intel.txt
   ```

2. **Add visibility rule** (optional, default is visible):
   Edit `/src/terminal/visibility.json`:
   ```json
   {
     "mission/intel.txt": false
   }
   ```

3. **Restart Vite:**
   ```bash
   npm run dev
   ```

4. **File appears in terminal** (if visible)

### Creating Progressive Content Reveals

Edit `/src/terminal/visibility.json` to hide content initially:

```json
{
  "mission/inbox": false,
  "mission/inbox/message1.txt": false,
  "home/cadet/clue1.txt": false
}
```

Later, update the JSON to reveal content as cadets progress through the training.

### Supporting Images

1. Add image to `/public/terminalFS/`:
   ```bash
   cp satellite.png /public/terminalFS/mission/
   ```

2. In terminal:
   ```bash
   cat mission/satellite.png
   ```
   
   Output:
   ```
   [IMAGE: mission/satellite.png]
   URL: /terminalFS/mission/satellite.png
   
   Note: Images cannot be displayed in terminal. Use a browser to view.
   ```

### Directory Structure Example

```
/public/terminalFS/
├── home/
│   └── cadet/          # Cadet's home directory
├── mission/            # Mission-specific content
│   ├── briefings/      # Operation briefings
│   └── inbox/          # Incoming messages
├── logs/               # System and network logs
├── tools/              # Operational tools
└── etc/                # Configuration files (optional)
```

## Technical Details

### How It Works

1. **Build Time**: Vite's `import.meta.glob()` discovers all files in `/public/terminalFS/`
2. **Load Time**: `fsLoader.js` converts glob results into virtual tree structure
3. **Runtime**: `VirtualFS` merges filesystem with visibility rules
4. **Command Execution**: Commands query `VirtualFS` which filters results by visibility

### File Types Supported

- **Text**: `.txt`, `.log`, `.dat`, `.md`, `.json`, `.sh` → Content loaded as string
- **Images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg` → URL provided
- **Future**: Add more types in `/src/terminal/fsLoader.js`

### Performance

- All files are loaded at terminal initialization (not on-demand)
- Visibility filtering happens in-memory (instant)
- Adding large files (>1MB) may impact initial load time

## Migration Guide

### From JSON Filesystem

Your existing JSON filesystem (`/public/filesystem.json`) still works! The system is backward compatible.

To migrate:

1. Create directory structure in `/public/terminalFS/`
2. Copy file contents from JSON to actual files
3. Update `CyberTerminal.jsx` to use real filesystem mode (already done)
4. Configure visibility rules
5. Test thoroughly
6. Remove old JSON file

## Troubleshooting

### Files not appearing in terminal

1. Check file is in `/public/terminalFS/`
2. Restart Vite dev server
3. Check browser console for errors
4. Verify visibility rules in `/src/terminal/visibility.json`

### Permission errors

1. Ensure parent directories are visible
2. Check path spelling in visibility.json (case-sensitive)
3. Paths should be relative without leading `/`

### Images not loading

1. Verify file extension is in fsLoader.js glob pattern
2. Check browser console for 404 errors
3. Ensure image is in `/public/terminalFS/` not `/src/`

## Future Enhancements

- [ ] Real-time file watching (hot reload without restart)
- [ ] Admin panel to toggle visibility dynamically
- [ ] Command to reveal hidden files (`unlock mission/inbox`)
- [ ] Binary file support (download links)
- [ ] File upload capability
- [ ] Search across all files (`grep` command)

## File Reference

### Created/Modified Files

- ✅ `/public/terminalFS/` - Real filesystem directory
- ✅ `/src/terminal/fsLoader.js` - File loading with import.meta.glob
- ✅ `/src/terminal/visibility.json` - Visibility configuration
- ✅ `/src/terminal/visibility.js` - Visibility helper functions
- ✅ `/src/terminal/fs.js` - Extended VirtualFS class
- ✅ `/src/terminal/commands/cat.js` - Image support added
- ✅ `/src/components/cyber/CyberTerminal.jsx` - Real filesystem integration

### Preserved Files

- ✅ All existing command modules unchanged (except cat.js enhancement)
- ✅ All UI components unchanged
- ✅ CommandParser unchanged
- ✅ All styling unchanged

## Testing Checklist

- [ ] `ls` shows only visible files
- [ ] `ls -l` shows detailed listing
- [ ] `cd` navigates to visible directories only
- [ ] `cd` blocks access to hidden directories
- [ ] `cat` displays text file contents
- [ ] `cat` shows image URLs
- [ ] `pwd` shows current directory
- [ ] Command history works (arrow keys)
- [ ] Dynamic prompt shows current directory
- [ ] Hidden files truly invisible in listings
- [ ] Adding new file + restart makes it appear
- [ ] Visibility rules correctly filter content
