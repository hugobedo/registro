import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = 'hugoac.bedo@gmail.com';
const RUNTIME_PASSCODE_FILE = '/tmp/acemed-delete-auth.json';

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git', '.aistudio', 'build', 'coverage']);
const EXCLUDED_FILES = new Set(['.env', '.env.local', '.env.production', '.DS_Store']);

function collectProjectFiles(rootDir: string, relativeDir = ''): Array<{ zipPath: string; fullPath: string }> {
  const results: Array<{ zipPath: string; fullPath: string }> = [];
  const currentDir = path.join(rootDir, relativeDir);
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      results.push(...collectProjectFiles(rootDir, path.join(relativeDir, entry.name)));
    } else if (entry.isFile()) {
      if (
        EXCLUDED_FILES.has(entry.name) ||
        (entry.name.startsWith('.env.') && entry.name !== '.env.example') ||
        entry.name.endsWith('.zip') ||
        entry.name.endsWith('.log')
      ) {
        continue;
      }
      const relPosix = path.join(relativeDir, entry.name).split(path.sep).join('/');
      results.push({
        zipPath: `ace-med/${relPosix}`,
        fullPath: path.join(currentDir, entry.name),
      });
    }
  }
  return results.sort((a, b) => a.zipPath.localeCompare(b.zipPath));
}

function buildProjectZipBuffer(rootDir: string): Buffer {
  const files = collectProjectFiles(rootDir);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const rawData = fs.readFileSync(file.fullPath);
    const compressed = zlib.deflateRawSync(rawData, { level: 6 });
    const crc = computeCrc32(rawData);
    const nameBuf = Buffer.from(file.zipPath, 'utf-8');

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirBuffer = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirBuffer.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuffer, endRecord]);
}

interface StoredPasscodeHash {
  salt: string;
  hash: string;
  updatedAt: string;
  updatedBy: string;
}

interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const failedAttempts = new Map<string, RateLimitEntry>();

function readFirebaseProjectId(): string {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (
      parsed.projectId &&
      parsed.projectId !== 'remixed-project-id' &&
      parsed.projectId.trim().length > 0
    ) {
      return parsed.projectId.trim();
    }
  } catch (err) {
    console.error('No se pudo leer firebase-applet-config.json:', err);
  }
  return '';
}

const projectId = readFirebaseProjectId();
const adminApp = projectId
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId })
  : null;

function hashPasscode(passcode: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function timingSafeVerify(passcode: string, stored: { salt: string; hash: string }): boolean {
  const derived = crypto.scryptSync(passcode, stored.salt, 64);
  const expected = Buffer.from(stored.hash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

// Compute hashed env secret at boot so plaintext is never compared directly
const envPasscode = (process.env.DELETE_RECORDS_PASSWORD || '').trim();
const envPasscodeHash = envPasscode.length > 0 ? hashPasscode(envPasscode) : null;

let runtimePasscodeCache: StoredPasscodeHash | null = null;

function loadRuntimePasscode(): StoredPasscodeHash | null {
  if (runtimePasscodeCache) return runtimePasscodeCache;
  try {
    if (fs.existsSync(RUNTIME_PASSCODE_FILE)) {
      const raw = fs.readFileSync(RUNTIME_PASSCODE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoredPasscodeHash>;
      if (typeof parsed.salt === 'string' && typeof parsed.hash === 'string') {
        runtimePasscodeCache = {
          salt: parsed.salt,
          hash: parsed.hash,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          updatedBy: parsed.updatedBy || ADMIN_EMAIL,
        };
        return runtimePasscodeCache;
      }
    }
  } catch {
    // Ignore unreadable runtime cache
  }
  return null;
}

function saveRuntimePasscode(passcode: string, actorEmail: string): void {
  const { salt, hash } = hashPasscode(passcode);
  const record: StoredPasscodeHash = {
    salt,
    hash,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  };
  runtimePasscodeCache = record;
  try {
    fs.writeFileSync(RUNTIME_PASSCODE_FILE, JSON.stringify(record), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  } catch {
    // Keep in-memory cache if filesystem is read-only
  }
}

function getActivePasscodeSource(): {
  configured: boolean;
  source: 'env' | 'server_setup' | 'unconfigured';
  hashRecord: { salt: string; hash: string } | null;
} {
  if (envPasscodeHash) {
    return { configured: true, source: 'env', hashRecord: envPasscodeHash };
  }
  const runtime = loadRuntimePasscode();
  if (runtime) {
    return { configured: true, source: 'server_setup', hashRecord: runtime };
  }
  return { configured: false, source: 'unconfigured', hashRecord: null };
}

async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!adminApp) {
    res.status(503).json({
      error: 'Servicio de autenticación del servidor no inicializado.',
    });
    return;
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Sesión requerida. Inicia sesión con tu cuenta autorizada.',
    });
    return;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken || idToken.length > 4096) {
    res.status(401).json({ error: 'Token de autenticación inválido.' });
    return;
  }

  try {
    const decoded = await getAuth(adminApp).verifyIdToken(idToken);
    if (!decoded.email_verified) {
      res.status(403).json({ error: 'La cuenta debe tener correo verificado.' });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      error: 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión.',
    });
  }
}

function getRateLimitKey(req: AuthenticatedRequest): string {
  const uid = req.user?.uid || 'anon';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${uid}:${ip}`;
}

function checkRateLimit(key: string): { blocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry) return { blocked: false, retryAfterSeconds: 0 };
  if (now >= entry.resetAt) {
    failedAttempts.delete(key);
    return { blocked: false, retryAfterSeconds: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

function recordFailedAttempt(key: string): number {
  const now = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry || now >= entry.resetAt) {
    failedAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return RATE_LIMIT_MAX_ATTEMPTS - 1;
  }
  entry.count += 1;
  failedAttempts.set(key, entry);
  return Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - entry.count);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get(
    '/api/delete-auth/status',
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const state = getActivePasscodeSource();
      const isAdmin = req.user?.email === ADMIN_EMAIL && req.user?.email_verified === true;
      res.json({
        configured: state.configured,
        source: state.source,
        isAdmin,
      });
    }
  );

  app.post(
    '/api/delete-auth/setup',
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const email = req.user?.email || '';
      if (email !== ADMIN_EMAIL || req.user?.email_verified !== true) {
        res.status(403).json({
          error: 'Solo el responsable administrador puede configurar la contraseña de autorización.',
        });
        return;
      }

      if (envPasscodeHash) {
        res.status(409).json({
          error:
            'La contraseña de eliminación está definida mediante la variable segura DELETE_RECORDS_PASSWORD en el servidor.',
        });
        return;
      }

      const body = req.body as { passcode?: unknown };
      const rawPasscode = typeof body.passcode === 'string' ? body.passcode.trim() : '';
      if (rawPasscode.length < 4 || rawPasscode.length > 32) {
        res.status(400).json({
          error: 'La contraseña debe tener entre 4 y 32 caracteres.',
        });
        return;
      }

      saveRuntimePasscode(rawPasscode, email);
      res.json({
        ok: true,
        message: 'Contraseña de autorización guardada de forma segura en el servidor.',
      });
    }
  );

  app.post(
    '/api/delete-auth/verify',
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const key = getRateLimitKey(req);
      const limitState = checkRateLimit(key);
      if (limitState.blocked) {
        res.status(429).json({
          authorized: false,
          error: `Demasiados intentos fallidos. Espera ${Math.ceil(limitState.retryAfterSeconds / 60)} min antes de intentar nuevamente.`,
        });
        return;
      }

      const active = getActivePasscodeSource();
      if (!active.configured || !active.hashRecord) {
        res.status(428).json({
          authorized: false,
          code: 'PASSCODE_NOT_CONFIGURED',
          error:
            'La contraseña de autorización aún no está configurada en el servidor. Configura DELETE_RECORDS_PASSWORD en los secretos del proyecto o regístrala como administrador.',
        });
        return;
      }

      const body = req.body as { passcode?: unknown };
      const candidate = typeof body.passcode === 'string' ? body.passcode.trim() : '';
      if (!candidate || candidate.length > 64) {
        res.status(400).json({
          authorized: false,
          error: 'Ingresa una contraseña válida.',
        });
        return;
      }

      const isMatch = timingSafeVerify(candidate, active.hashRecord);
      if (!isMatch) {
        const remainingAttempts = recordFailedAttempt(key);
        res.status(403).json({
          authorized: false,
          remainingAttempts,
          error:
            remainingAttempts > 0
              ? `Contraseña incorrecta. Te quedan ${remainingAttempts} ${remainingAttempts === 1 ? 'intento' : 'intentos'}.`
              : 'Contraseña incorrecta. Se bloqueó temporalmente la verificación por seguridad.',
        });
        return;
      }

      failedAttempts.delete(key);
      res.json({
        authorized: true,
        verifiedAt: new Date().toISOString(),
        verifiedByEmail: req.user?.email || '',
        verifiedByName: req.user?.name || req.user?.email || 'Personal autorizado',
      });
    }
  );

  app.get(
    '/api/export-project-zip',
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const email = req.user?.email || '';
      if (email !== ADMIN_EMAIL || req.user?.email_verified !== true) {
        res.status(403).json({
          error: 'Solo la cuenta administradora puede descargar el paquete completo del proyecto.',
        });
        return;
      }

      try {
        const zipBuffer = buildProjectZipBuffer(__dirname);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="ACE-MED-proyecto-completo.zip"'
        );
        res.setHeader('Content-Length', String(zipBuffer.length));
        res.send(zipBuffer);
      } catch (err) {
        console.error('Error al empaquetar proyecto ZIP:', err);
        res.status(500).json({ error: 'No se pudo generar el archivo ZIP del proyecto.' });
      }
    }
  );

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ACE-MED servidor activo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error al iniciar el servidor ACE-MED:', err);
  process.exit(1);
});
