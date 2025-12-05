# Inject Control System - Testing Guide

## 🎯 What We Built

A complete inject control dashboard that allows admins to send mission injects to specific teams via Socket.IO (no Firebase quota exhaustion!).

## ✅ Components Created

### Frontend Components
1. **AdminInjectPanel** - Main control panel with collapsible team sections
2. **InjectLogViewer** - Real-time log of sent injects
3. **InjectFeed** - Updated to show injects to teams (filtered by team)

### Inject Handlers (Placeholders)
All located in `src/injects/`:
- **SDA:** `satellite-dropout`, `unknown-satellite`
- **Cyber:** `virus-detected`, `enemy-website`
- **Intel:** `asat-imagery`, `cryptic-tweet`
- **EW:** `unidentified-signal`, `spectrum-outage`

### Backend
- Socket.IO event handler for `inject:send`
- Broadcasts to specific teams, admin, and session feed

## 🧪 How to Test

### 1. Start the Application
```bash
# Backend
cd server
npm start

# Frontend
npm run dev
```

### 2. Test Flow

#### As Admin:
1. Navigate to Admin Dashboard
2. Generate a session code
3. Initialize operation
4. Scroll to **Inject Control Dashboard**
5. Expand any team section (SDA, Cyber, Intel, EW)
6. Click **"Send Inject"** on any inject card

#### What Should Happen:
✅ **InjectLogViewer** (below inject panel) shows the sent inject immediately  
✅ **InjectFeed** (top of page) shows the inject for admin  
✅ **Console logs** show Socket.IO events:
```
[AdminInjectPanel] Sending inject: { team: 'sda', type: 'satellite-dropout', ... }
[Socket] 📡 Inject sent to sda: satellite-dropout - Satellite Dropout
[Socket]   → Sent to team:sda
[Socket]   → Logged for admin
[Socket]   → Broadcasted to session feed
[InjectFeed] Admin received inject:new
[InjectLogViewer] Received inject log
```

#### As Team Member:
1. Join the session as a specific team (e.g., `/dashboard/sda/FLINT-XXX`)
2. Wait for admin to send an inject to your team
3. Check **InjectFeed** on your dashboard

#### What Should Happen:
✅ InjectFeed shows ONLY injects sent to your team  
✅ New inject appears with purple pulsing dot + "NEW" badge  
✅ Console shows: `[InjectFeed] Received inject for team: sda`

### 3. Check Console Logs

Each inject handler logs placeholder messages:
```
[Inject] Satellite Dropout - PLACEHOLDER
TODO: Implement satellite removal logic
TODO: Set 2-minute timer for restoration
TODO: Listen for EW recovery signal
```

## 📋 Next Steps

### Implement Injects One-by-One

Start with easiest first:

1. **virus-detected** (Cyber) - Similar to Flint files, just add virus file to terminal
2. **unidentified-signal** (EW) - Add new signal to audioTransmissions
3. **unknown-satellite** (SDA) - Add satellite to orbit viewer
4. **asat-imagery** (Intel) - Display new image in Intel dashboard
5. **cryptic-tweet** (Intel) - Display tweet with encoded message
6. **enemy-website** (Cyber) - Display URL in terminal output
7. **satellite-dropout** (SDA) - Remove satellite + timer logic
8. **spectrum-outage** (EW) - Disable visualization + coordinate with Cyber

### For Each Inject Implementation:

1. Update the handler in `src/injects/{team}/{inject}.js`
2. Add necessary state management to team dashboard
3. Listen for `inject:received` Socket event in team component
4. Execute inject logic based on `data.type`
5. Test with admin sending inject → team receiving → logic executing

## 🔄 Socket.IO Event Flow

```
Admin Dashboard (AdminInjectPanel)
    ↓ socket.sendInject(team, type, title, description, payload)
    ↓
Backend Server (socket.js)
    ↓ socket.on('inject:send')
    ↓
    ├─→ io.emit('inject:received') → Team Dashboard
    ├─→ io.emit('inject:log')      → Admin (InjectLogViewer)
    └─→ io.emit('inject:new')      → Session (InjectFeed - filtered)
```

## 🎨 UI Features

- **Color-coded by team:** Blue (SDA), Green (Cyber), Purple (Intel), Red (EW)
- **Collapsible sections:** Click team header to expand/collapse
- **Real-time updates:** No page refresh needed
- **Disabled state:** Buttons disabled until session active
- **Empty states:** Shows helpful messages when no injects sent
- **New indicators:** Purple pulse + "NEW" badge for 5 seconds

## 🚀 Ready to Test!

Everything is wired up and ready. Send some test injects and watch the Socket.IO magic happen! 🎉
