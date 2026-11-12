import express from 'express'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import multer from 'multer'
import qrcode from 'qrcode'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import mime from 'mime-types'

export interface TransferDevice {
  id: string
  name: string
  ip: string
  connectedAt: Date
  userAgent?: string
}

export interface TransferHistoryItem {
  id: string
  fileName: string
  fileSize: number
  direction: 'upload' | 'download'
  device: string
  timestamp: Date
  status: 'completed' | 'failed'
  speed?: number
}

export class TransferServer {
  private app: express.Express | null = null
  private server: http.Server | null = null
  private io: SocketIOServer | null = null
  private isRunning: boolean = false
  private port: number = 52140
  private authToken: string = ''
  private downloadDir: string = ''
  private sharedFiles: Array<{ name: string; path: string; size: number; id: string }> = []
  private connectedDevices: Map<string, TransferDevice> = new Map()
  private transferHistory: TransferHistoryItem[] = []
  private onProgressCallback?: (data: any) => void
  private onDeviceCallback?: (device: TransferDevice) => void
  private onDeviceDisconnectCallback?: (deviceId: string) => void

  constructor() {
    this.downloadDir = path.join(os.homedir(), 'Downloads', 'StorageFlow')
  }

  public setCallbacks(callbacks: {
    onProgress?: (data: any) => void
    onDeviceConnected?: (device: TransferDevice) => void
    onDeviceDisconnected?: (deviceId: string) => void
  }) {
    this.onProgressCallback = callbacks.onProgress
    this.onDeviceCallback = callbacks.onDeviceConnected
    this.onDeviceDisconnectCallback = callbacks.onDeviceDisconnected
  }

  public getLocalIP(): string {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address
        }
      }
    }
    return '127.0.0.1'
  }

  public async start(port = 52140, targetDownloadDir?: string): Promise<{
    success: boolean
    port: number
    url: string
    qrCodeDataUrl: string
    token: string
    ip: string
    error?: string
  }> {
    if (this.isRunning) {
      const ip = this.getLocalIP()
      const url = `http://${ip}:${this.port}?token=${this.authToken}`
      const qr = await qrcode.toDataURL(url, { width: 320, margin: 2 })
      return {
        success: true,
        port: this.port,
        url,
        qrCodeDataUrl: qr,
        token: this.authToken,
        ip
      }
    }

    try {
      this.port = port
      if (targetDownloadDir) {
        this.downloadDir = targetDownloadDir
      }
      if (!fs.existsSync(this.downloadDir)) {
        fs.mkdirSync(this.downloadDir, { recursive: true })
      }

      this.authToken = crypto.randomBytes(16).toString('hex')
      this.app = express()
      this.server = http.createServer(this.app)
      this.server.keepAliveTimeout = 65000
      this.server.headersTimeout = 66000
      this.io = new SocketIOServer(this.server, {
        cors: { origin: '*' }
      })

      // Completely open CORS and disable HTTP caching for instant live updates across all devices
      this.app.use((_req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
        res.setHeader('Access-Control-Allow-Headers', '*')
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
        if (_req.method === 'OPTIONS') {
          return res.sendStatus(200)
        }
        next()
      })

      // Ensure socket.io client script is served reliably
      this.app.get('/socket.io/socket.io.js', (_req, res) => {
        try {
          const clientPath = path.join(__dirname, '../node_modules/socket.io-client/dist/socket.io.min.js')
          if (fs.existsSync(clientPath)) {
            return res.sendFile(clientPath)
          }
        } catch {}
        try {
          const fallback = require.resolve('socket.io-client/dist/socket.io.min.js')
          if (fs.existsSync(fallback)) {
            return res.sendFile(fallback)
          }
        } catch {}
        res.status(404).end()
      })

      // Configure Multer for File Uploads
      const storage = multer.diskStorage({
        destination: (_req, _file, cb) => {
          if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true })
          }
          cb(null, this.downloadDir)
        },
        filename: (_req, file, cb) => {
          const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._\-\s]/g, '_')
          let finalName = safeName
          let counter = 1
          while (fs.existsSync(path.join(this.downloadDir, finalName))) {
            const ext = path.extname(safeName)
            const base = path.basename(safeName, ext)
            finalName = `${base}_${counter}${ext}`
            counter++
          }
          cb(null, finalName)
        }
      })

      const upload = multer({
        storage,
        limits: { fileSize: 10 * 1024 * 1024 * 1024 } // 10 GB max file size
      })

      // Serve mobile web interface directly to any connected device
      this.app.get('/', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.send(this.getMobileHtml())
      })

      // API: Get shared files list (PC to Mobile) - Zero auth barrier, instant live JSON
      this.app.get('/api/files', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.json({
          success: true,
          files: this.sharedFiles.map(f => ({
            id: f.id,
            name: f.name,
            size: f.size
          }))
        })
      })

      // API: Download file (PC to Mobile) - High-Performance Streaming with HTTP Range Support
      const downloadHandler = (req: express.Request, res: express.Response) => {
        const file = this.sharedFiles.find(f => f.id === req.params.id)
        if (!file || !fs.existsSync(file.path)) {
          return res.status(404).send('File not found or no longer available on PC.')
        }

        try {
          const stat = fs.statSync(file.path)
          const fileSize = stat.size
          const mimeType = (mime.lookup(file.name) as string) || 'application/octet-stream'

          // Enable TCP optimizations for high-throughput LAN Wi-Fi transfers
          if (res.socket) {
            res.socket.setNoDelay(true)
            res.socket.setKeepAlive(true, 1000)
          }

          res.setHeader('Accept-Ranges', 'bytes')
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`
          )
          res.setHeader('Cache-Control', 'public, max-age=3600')

          const range = req.headers.range

          if (range) {
            // Handle HTTP 206 Partial Content (Multi-stream download & Resume support)
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

            if (isNaN(start) || start >= fileSize || (parts[1] && end < start)) {
              res.setHeader('Content-Range', `bytes */${fileSize}`)
              return res.status(416).send('Requested Range Not Satisfiable')
            }

            const chunksize = end - start + 1
            res.status(206)
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
            res.setHeader('Content-Length', chunksize)
            res.setHeader('Content-Type', mimeType)

            // High buffer size (2 MB) for maximum throughput on local Wi-Fi
            const fileStream = fs.createReadStream(file.path, {
              start,
              end,
              highWaterMark: 2 * 1024 * 1024
            })
            fileStream.pipe(res)

            fileStream.on('error', (err) => {
              console.error('Range stream error:', err)
              if (!res.headersSent) res.status(500).send('Error streaming file.')
            })
          } else {
            // Full file transfer
            res.status(200)
            res.setHeader('Content-Type', mimeType)
            res.setHeader('Content-Length', fileSize)

            // High buffer size (2 MB) for blazing-fast sequential transfers
            const fileStream = fs.createReadStream(file.path, {
              highWaterMark: 2 * 1024 * 1024
            })
            fileStream.pipe(res)

            fileStream.on('end', () => {
              const clientIp = req.ip || req.socket.remoteAddress || 'Mobile'
              const historyItem: TransferHistoryItem = {
                id: crypto.randomUUID(),
                fileName: file.name,
                fileSize: file.size,
                direction: 'download',
                device: clientIp,
                timestamp: new Date(),
                status: 'completed'
              }
              this.transferHistory.unshift(historyItem)

              this.io?.emit('transfer:complete', historyItem)
              if (this.onProgressCallback) {
                this.onProgressCallback({ type: 'download', ...historyItem })
              }
            })

            fileStream.on('error', (err) => {
              console.error('File stream error:', err)
              if (!res.headersSent) {
                res.status(500).send('Error streaming file from PC.')
              }
            })
          }
        } catch (err: any) {
          if (!res.headersSent) {
            res.status(500).send(`Server error: ${err.message}`)
          }
        }
      }

      this.app.get('/api/download/:id', downloadHandler)
      this.app.get('/api/download/:id/:filename', downloadHandler)

      // API: Upload files (Mobile to PC) - Zero auth barrier
      this.app.post('/api/upload', upload.array('files'), (req, res) => {
        const files = req.files as Express.Multer.File[]
        if (!files || files.length === 0) {
          return res.status(400).json({ error: 'No files received' })
        }

        const clientIp = req.ip || req.socket.remoteAddress || 'Mobile'
        const uploadedList = files.map(file => {
          const item: TransferHistoryItem = {
            id: crypto.randomUUID(),
            fileName: file.filename,
            fileSize: file.size,
            direction: 'upload',
            device: clientIp,
            timestamp: new Date(),
            status: 'completed'
          }
          this.transferHistory.unshift(item)
          return item
        })

        this.io?.emit('transfer:uploaded', uploadedList)
        if (this.onProgressCallback) {
          this.onProgressCallback({ type: 'upload_batch', items: uploadedList })
        }

        res.json({ success: true, count: files.length, files: uploadedList })
      })

      // Socket.IO for real-time events & pairing status
      this.io.on('connection', (socket) => {
        const clientIp = socket.handshake.address
        const userAgent = socket.handshake.headers['user-agent'] || 'Mobile Device'
        const isAndroid = /Android/i.test(userAgent)
        const isIOS = /iPhone|iPad/i.test(userAgent)
        const deviceName = isAndroid ? 'Android Phone' : isIOS ? 'iOS Device' : 'Mobile Browser'

        const device: TransferDevice = {
          id: socket.id,
          name: deviceName,
          ip: clientIp,
          connectedAt: new Date(),
          userAgent
        }

        this.connectedDevices.set(socket.id, device)
        if (this.onDeviceCallback) this.onDeviceCallback(device)
        this.io?.emit('devices:update', Array.from(this.connectedDevices.values()))

        socket.on('disconnect', () => {
          this.connectedDevices.delete(socket.id)
          if (this.onDeviceDisconnectCallback) this.onDeviceDisconnectCallback(socket.id)
          this.io?.emit('devices:update', Array.from(this.connectedDevices.values()))
        })
      })

      await new Promise<void>((resolve, reject) => {
        this.server?.listen(this.port, '0.0.0.0', () => {
          this.isRunning = true
          resolve()
        })
        this.server?.on('error', (err) => {
          reject(err)
        })
      })

      const ip = this.getLocalIP()
      const url = `http://${ip}:${this.port}?token=${this.authToken}`
      const qrCodeDataUrl = await qrcode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })

      return {
        success: true,
        port: this.port,
        url,
        qrCodeDataUrl,
        token: this.authToken,
        ip
      }
    } catch (err: any) {
      this.isRunning = false
      return {
        success: false,
        port: this.port,
        url: '',
        qrCodeDataUrl: '',
        token: '',
        ip: '',
        error: err.message
      }
    }
  }

  public async stop(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isRunning || !this.server) {
        resolve(true)
        return
      }

      this.io?.close()
      this.server.close(() => {
        this.isRunning = false
        this.app = null
        this.server = null
        this.io = null
        this.connectedDevices.clear()
        resolve(true)
      })
    })
  }

  public setDownloadDir(dir: string): boolean {
    if (!dir) return false
    this.downloadDir = dir
    if (!fs.existsSync(this.downloadDir)) {
      try {
        fs.mkdirSync(this.downloadDir, { recursive: true })
      } catch {
        return false
      }
    }
    return true
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      ip: this.getLocalIP(),
      token: this.authToken,
      downloadDir: this.downloadDir,
      connectedDevices: Array.from(this.connectedDevices.values()),
      history: this.transferHistory,
      sharedFilesCount: this.sharedFiles.length
    }
  }

  public addSharedFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false
    const stats = fs.statSync(filePath)
    const existing = this.sharedFiles.find(f => f.path === filePath)
    if (!existing) {
      this.sharedFiles.push({
        id: crypto.randomUUID(),
        name: path.basename(filePath),
        path: filePath,
        size: stats.size
      })
      this.io?.emit('files:update', this.sharedFiles.map(f => ({ id: f.id, name: f.name, size: f.size })))
    }
    return true
  }

  public removeSharedFile(fileId: string): boolean {
    const idx = this.sharedFiles.findIndex(f => f.id === fileId)
    if (idx !== -1) {
      this.sharedFiles.splice(idx, 1)
      this.io?.emit('files:update', this.sharedFiles.map(f => ({ id: f.id, name: f.name, size: f.size })))
      return true
    }
    return false
  }

  public getSharedFiles() {
    return this.sharedFiles
  }

  private getMobileHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>StorageFlow Mobile Transfer</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    :root {
      --bg: #090a0f;
      --card: rgba(255, 255, 255, 0.05);
      --card-border: rgba(255, 255, 255, 0.1);
      --accent: #3b82f6;
      --accent-gradient: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 16px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      backdrop-filter: blur(12px);
      margin-bottom: 20px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-icon {
      width: 32px;
      height: 32px;
      background: var(--accent-gradient);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      padding: 4px 10px;
      border-radius: 20px;
      font-weight: 500;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 18px;
      margin-bottom: 20px;
      backdrop-filter: blur(12px);
    }
    .upload-zone {
      border: 2px dashed rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 26px 16px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: rgba(255, 255, 255, 0.02);
    }
    .upload-zone:active, .upload-zone.dragover {
      border-color: var(--accent);
      background: rgba(59, 130, 246, 0.08);
    }
    .upload-icon {
      font-size: 36px;
      margin-bottom: 8px;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 13px;
      background: var(--accent-gradient);
      border: none;
      border-radius: 14px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      margin-top: 12px;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    }
    .btn-outline {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      box-shadow: none;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .progress-bar-bg {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      height: 8px;
      overflow: hidden;
      margin: 12px 0 6px;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: var(--accent-gradient);
      transition: width 0.2s;
    }
    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      margin-bottom: 10px;
    }
    .file-name {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
      color: #f1f5f9;
    }
    .file-size {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .download-btn {
      background: #3b82f6;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .download-btn:active {
      transform: scale(0.96);
    }
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(16, 185, 129, 0.95);
      color: #fff;
      padding: 10px 18px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      z-index: 100;
      display: none;
      animation: fadeIn 0.3s;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div>
        <h3 style="font-size:16px;">StorageFlow</h3>
        <p style="font-size:11px;color:var(--text-muted);">Wireless Direct Connect</p>
      </div>
    </div>
    <div class="badge">
      <span class="dot"></span>
      <span id="conn-status">Connected to PC</span>
    </div>
  </div>

  <div class="section-title">
    <span>Files on PC (Ready to Download) <span id="files-count-badge" style="font-size:11px;font-weight:normal;opacity:0.8;"></span></span>
    <button class="btn-outline" onclick="checkFiles(true)">🔄 Refresh</button>
  </div>
  <div id="sync-status-bar" style="font-size:11px;color:#94a3b8;margin-bottom:10px;padding-left:4px;">🟢 Live Sync Active • Connected to PC</div>

  <div class="card" id="pc-files-container">
    <div id="no-files" style="text-align:center;color:var(--text-muted);font-size:13px;padding:26px 12px;">
      <div style="font-size:32px;margin-bottom:8px;">📥</div>
      <div style="font-weight:600;color:#e2e8f0;margin-bottom:4px;">No files currently shared by PC</div>
      <div>Click "+ Add Files" on your PC to share files directly to your phone.</div>
    </div>
    <div id="files-list"></div>
    <div id="download-all-container" style="display:none;margin-top:12px;">
      <button class="btn" onclick="downloadAllFiles()">Download All Files</button>
    </div>
  </div>

  <div class="section-title">Send Files to PC</div>
  <div class="card">
    <div class="upload-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">
      <div class="upload-icon">📤</div>
      <p style="font-size:15px;font-weight:600;margin-bottom:4px;">Tap to Choose Files from Phone</p>
      <p style="font-size:12px;color:var(--text-muted);">Photos, Videos, Documents (Up to 10 GB)</p>
      <input type="file" id="file-input" multiple style="display:none;" onchange="handleFilesSelected(this.files)">
    </div>
    
    <div id="upload-status" style="display:none;margin-top:16px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;">
        <span id="upload-file-label">Uploading...</span>
        <span id="upload-percentage">0%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" id="upload-progress-fill"></div>
      </div>
      <p id="upload-details" style="font-size:11px;color:var(--text-muted);margin-top:4px;"></p>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    let currentSharedFiles = [];
    let knownFileIds = new Set();
    const token = new URLSearchParams(window.location.search).get('token') || '';

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 3000);
    }

    // Try Socket.IO if available
    try {
      if (typeof io !== 'undefined') {
        const socket = io({ transports: ['websocket', 'polling'] });
        socket.on('connect', () => {
          document.getElementById('conn-status').textContent = 'Live Connected';
          checkFiles();
        });
        socket.on('disconnect', () => {
          document.getElementById('conn-status').textContent = 'Auto-Sync Active';
        });
        socket.on('files:update', (files) => {
          if (Array.isArray(files)) {
            renderSharedFiles(files);
          }
        });
      }
    } catch (e) {
      console.warn('Socket init fallback:', e);
    }

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    function renderSharedFiles(files) {
      currentSharedFiles = files || [];
      const container = document.getElementById('files-list');
      const noFiles = document.getElementById('no-files');
      const dlAllContainer = document.getElementById('download-all-container');
      const countBadge = document.getElementById('files-count-badge');
      const syncStatus = document.getElementById('sync-status-bar');

      if (countBadge) {
        countBadge.textContent = files.length > 0 ? '(' + files.length + ' file' + (files.length > 1 ? 's' : '') + ')' : '';
      }

      if (syncStatus) {
        syncStatus.textContent = files.length > 0 
          ? '🟢 ' + files.length + ' file' + (files.length > 1 ? 's' : '') + ' ready to download • Synced ' + new Date().toLocaleTimeString()
          : '🟢 Live Sync Active • Waiting for PC files...';
      }

      if (!files || files.length === 0) {
        container.innerHTML = '';
        noFiles.style.display = 'block';
        if (dlAllContainer) dlAllContainer.style.display = 'none';
        return;
      }

      // Check if new files arrived
      let isNew = false;
      files.forEach(f => {
        if (!knownFileIds.has(f.id)) {
          isNew = true;
          knownFileIds.add(f.id);
        }
      });

      if (isNew && knownFileIds.size > files.length - 1) {
        showToast('📥 ' + files.length + ' file(s) ready from PC!');
        if (typeof navigator.vibrate === 'function') {
          try { navigator.vibrate([100, 50, 100]); } catch(e){}
        }
      }

      noFiles.style.display = 'none';
      if (dlAllContainer) dlAllContainer.style.display = files.length > 1 ? 'block' : 'none';

      container.innerHTML = files.map(f => {
        const isVideo = /\\.(mp4|mkv|avi|mov|wmv|webm|m4v)$/i.test(f.name);
        const isImage = /\\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(f.name);
        const isAudio = /\\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(f.name);
        const isDoc = /\\.(pdf|doc|docx|txt|xls|xlsx|ppt|pptx)$/i.test(f.name);
        const isZip = /\\.(zip|rar|7z|tar|gz)$/i.test(f.name);
        const icon = isVideo ? '🎬' : isImage ? '🖼️' : isAudio ? '🎵' : isDoc ? '📄' : isZip ? '📦' : '📁';
        const dlUrl = '/api/download/' + f.id + '/' + encodeURIComponent(f.name);

        return \`
          <div class="file-item">
            <div style="font-size:26px;flex-shrink:0;">\${icon}</div>
            <div style="min-width:0;flex:1;overflow:hidden;">
              <div class="file-name" title="\${f.name}">\${f.name}</div>
              <div class="file-size">\${formatBytes(f.size)} • High-Speed Local WiFi</div>
            </div>
            <a
              id="dl-btn-\${f.id}"
              class="download-btn"
              href="\${dlUrl}"
              download="\${f.name}"
              onclick="handleDlClick('\${f.id}')"
            >
              Download
            </a>
          </div>
        \`;
      }).join('');
    }

    function handleDlClick(id) {
      const btn = document.getElementById('dl-btn-' + id);
      if (btn) {
        btn.innerText = 'Downloading... ⏳';
        btn.style.opacity = '0.8';
        setTimeout(() => {
          btn.innerText = 'Saved! ✅';
          btn.style.background = '#10b981';
          btn.style.opacity = '1';
          setTimeout(() => {
            btn.innerText = 'Download';
            btn.style.background = '';
          }, 4000);
        }, 2000);
      }
    }

    function downloadAllFiles() {
      if (!currentSharedFiles || currentSharedFiles.length === 0) return;
      currentSharedFiles.forEach((file, index) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = '/api/download/' + file.id + '/' + encodeURIComponent(file.name);
          a.setAttribute('download', file.name);
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            try { document.body.removeChild(a); } catch(e){}
          }, 1000);
        }, index * 800);
      });
      showToast('Starting download of all ' + currentSharedFiles.length + ' file(s)...');
    }

    function checkFiles(isManual) {
      const syncStatus = document.getElementById('sync-status-bar');
      if (isManual && syncStatus) {
        syncStatus.textContent = '🔄 Refreshing files list...';
      }

      fetch('/api/files?t=' + Date.now(), { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(data => {
          if (data && Array.isArray(data.files)) {
            renderSharedFiles(data.files);
            if (isManual) {
              showToast('Refreshed: ' + data.files.length + ' file(s) available');
            }
          }
        })
        .catch(err => {
          console.warn('Sync check:', err);
          if (syncStatus) {
            syncStatus.textContent = '🟡 Connecting to PC...';
          }
        });
    }

    // High-frequency polling every 1.5 seconds for instant file discovery
    checkFiles();
    setInterval(() => checkFiles(false), 1500);

    function handleFilesSelected(files) {
      if (!files || files.length === 0) return;
      uploadFiles(files);
    }

    function uploadFiles(fileList) {
      const formData = new FormData();
      for (let i = 0; i < fileList.length; i++) {
        formData.append('files', fileList[i]);
      }

      const statusDiv = document.getElementById('upload-status');
      const label = document.getElementById('upload-file-label');
      const percentEl = document.getElementById('upload-percentage');
      const fill = document.getElementById('upload-progress-fill');
      const details = document.getElementById('upload-details');

      statusDiv.style.display = 'block';
      label.textContent = \`Uploading \${fileList.length} file\${fileList.length > 1 ? 's' : ''} to PC...\`;
      percentEl.textContent = '0%';
      fill.style.width = '0%';

      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          percentEl.textContent = percent + '%';
          fill.style.width = percent + '%';
          const elapsedSec = (Date.now() - startTime) / 1000;
          const speed = elapsedSec > 0 ? e.loaded / elapsedSec : 0;
          details.textContent = \`\${formatBytes(e.loaded)} of \${formatBytes(e.total)} (\${formatBytes(speed)}/s)\`;
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          label.textContent = 'Upload to PC Complete! ✅';
          percentEl.textContent = '100%';
          fill.style.width = '100%';
          fill.style.background = '#10b981';
          showToast('Uploaded ' + fileList.length + ' file(s) to PC!');
          setTimeout(() => {
            statusDiv.style.display = 'none';
            fill.style.background = 'var(--accent-gradient)';
          }, 3500);
        } else {
          label.textContent = 'Upload failed ❌';
          details.textContent = 'Server error ' + xhr.status;
        }
      };

      xhr.onerror = () => {
        label.textContent = 'Network Error ❌';
        details.textContent = 'Could not reach StorageFlow PC server';
      };

      xhr.open('POST', '/api/upload?token=' + encodeURIComponent(token), true);
      xhr.send(formData);
    }
  </script>
</body>
</html>`
  }
}

export const transferServer = new TransferServer()

