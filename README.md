# StorageFlow 2.0 ⚡
> Premium Desktop File Manager & Wireless Transfer System for Windows

StorageFlow 2.0 is a modern, high-performance desktop file manager built from scratch with **Electron, React, TypeScript, Vite, Tailwind CSS, Framer Motion**, and **Express / Socket.IO**. It features a macOS-inspired dark glassmorphism interface, deep disk analytics, and direct zero-cloud PC-to-Android file synchronization.

---

## 🌟 Key Features

### 1. Modern Glassmorphic Design System
- macOS-inspired frosted glass sidebar (`backdrop-blur-2xl`)
- Dark theme by default with optional clean Light theme toggle
- Smooth Framer Motion layout transitions and subtle ambient glows
- Custom frameless title bar with native window controls (minimize, maximize, close)

### 2. Comprehensive System Dashboard
- Real-time disk capacity meters (Total, Used, Available Free space, % utilization)
- Multi-drive detection for Windows (`C:`, `D:`, removable media) with automatic filesystem type discovery
- Dynamic quick-access shortcuts (Desktop, Documents, Downloads, Pictures, Music, Videos)
- Real-time file type distribution breakdown (Images, Videos, Documents, Audio, Archives, Code)
- Instant recent files monitor

### 3. Full-Featured Windows File Explorer
- Native Windows directory traversal with clickable breadcrumb navigation
- Operations: **Create Folder, Rename, Copy, Cut, Paste, Delete**
- Multi-select (Ctrl+Click, Shift+Click, Select All)
- Grid & List view modes with instant sorting by Name, Size, Modified Date, and Type
- Real-time in-folder search filter
- Built-in preview drawer for images and text/code files
- File properties dialog with full path inspection, exact byte size, and timestamp attributes
- Native Recycle Bin integration via Electron Shell APIs

### 4. Non-Blocking Storage Analyzer
- Asynchronous, chunked recursive folder scanner that **never freezes the UI**
- Real-time scan telemetry: scanned size, processed files, and directories traversed
- Instant user cancellation support
- Automatic identification of the top space-consuming folders
- Categorized file type storage distribution bars
- In-memory result caching (5-minute TTL) for instant re-visits

### 5. Wireless Direct Transfer (PC ⟷ Android)
- Built-in local Express.js + Socket.IO transfer gateway
- Zero external internet or cloud dependency — direct over local Wi-Fi
- One-click pairing via dynamically generated QR code containing temporary HMAC tokens
- **Android Web App**: Mobile browser opens a sleek, responsive glassmorphic interface on scanning the QR code
- **Android to PC**: Multi-file upload up to 10 GB with real-time transfer progress, speed calculations, and automatic conflict avoidance
- **PC to Android**: Select any files on your PC to share directly to connected phones for instant download
- Live paired device monitor and transfer history log

---

## 🔒 Security Architecture
- `contextIsolation: true` and `nodeIntegration: false` strictly enforced
- Secure preload script exposing minimal, validated APIs via `contextBridge`
- Token-authenticated endpoints for wireless transfer
- Strict path traversal sanitization for file uploads

---

## 🚀 Getting Started

### Development Mode
To start both the Vite dev server and the Electron application concurrently:

```bash
npm run dev
```

### Production Build
To compile the TypeScript code, bundle frontend assets with Vite, and compile the Electron main process:

```bash
node ./node_modules/vite/bin/vite.js build
```

### Windows Installer Generation
To build the production Windows NSIS installer and unpacked binaries in `./release/`:

```bash
node ./node_modules/electron-builder/cli.js --win
```

---

## 📁 Project Architecture

```
storageflow/
├── electron/
│   ├── main.ts              # Main Electron process & IPC handlers
│   ├── preload.ts           # Context bridge security layer
│   └── ipc/
│       └── storageScanner.ts# Non-blocking async recursive storage scanner
├── server/
│   └── transferServer.ts    # Express + Socket.IO + Multer wireless gateway
├── src/
│   ├── components/
│   │   ├── layout/          # TitleBar, Sidebar
│   │   └── ui/              # Glass Cards, Buttons, Progress, Modals, Badges
│   ├── hooks/               # useTheme
│   ├── layouts/             # AppLayout
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── FileExplorer.tsx
│   │   ├── StorageAnalyzer.tsx
│   │   ├── WirelessTransfer.tsx
│   │   ├── RecentFiles.tsx
│   │   ├── Favorites.tsx
│   │   ├── Trash.tsx
│   │   └── Settings.tsx
│   ├── styles/              # globals.css
│   ├── types/               # TypeScript interfaces
│   ├── utils/               # Formatters & validators
│   ├── App.tsx              # React Router structure
│   └── main.tsx             # React DOM root
├── public/
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

