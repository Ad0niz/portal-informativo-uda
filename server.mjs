import http from 'node:http';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import webPush from 'web-push';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(root, 'public');

async function loadDotEnv() {
  try {
    const lines = (await readFile(join(root, '.env'), 'utf8')).split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
await loadDotEnv();
const dataPath = process.env.DATA_PATH || join(root, 'data', 'portal.json');

const categories = ['Clases', 'Evaluaciones', 'Salas', 'Convocatorias', 'General'];
const sessions = new Map();
const loginAttempts = new Map();
let writeQueue = Promise.resolve();
let database;

function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

if (pushConfigured()) webPush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function passwordMatches(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const demoItems = [
  {
    id: 'ejemplo-clases', title: 'Ejemplo: suspensión de una clase',
    summary: 'Así se vería un aviso cuando una clase deba suspenderse o cambiar de horario.',
    body: 'Este es un aviso de demostración. La secretaría puede indicar aquí el ramo, la sección, el docente, la fecha afectada y las instrucciones para estudiantes.',
    category: 'Clases', priority: 'urgent', status: 'published',
    eventDate: '', publishedAt: '2026-10-16T12:00:00.000Z', updatedAt: '2026-10-16T12:00:00.000Z', demo: true
  },
  {
    id: 'ejemplo-evaluaciones', title: 'Ejemplo: calendario de evaluaciones',
    summary: 'Un espacio para fechas, cambios y detalles de pruebas o entregas.',
    body: 'Este es un aviso de demostración. En un aviso real se puede publicar la fecha confirmada, la asignatura, la sala y un enlace a información adicional.',
    category: 'Evaluaciones', priority: 'normal', status: 'published',
    eventDate: '', publishedAt: '2026-10-15T12:00:00.000Z', updatedAt: '2026-10-15T12:00:00.000Z', demo: true
  },
  {
    id: 'ejemplo-salas', title: 'Ejemplo: cambio de sala',
    summary: 'Los cambios de sala quedan visibles y son fáciles de encontrar desde el celular.',
    body: 'Este es un aviso de demostración. Al publicar un cambio real, especifica la sala original, la nueva sala, el horario y la sección.',
    category: 'Salas', priority: 'normal', status: 'published',
    eventDate: '', publishedAt: '2026-10-14T12:00:00.000Z', updatedAt: '2026-10-14T12:00:00.000Z', demo: true
  }
];

async function getDatabase() {
  if (database) return database;
  try {
    database = JSON.parse(await readFile(dataPath, 'utf8'));
    if (!Array.isArray(database.announcements) || !Array.isArray(database.subscribers)) throw new Error('Formato de datos inválido');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    database = { announcements: demoItems, subscribers: [], pushSubscriptions: [], users: [] };
    await saveDatabase();
  }
  database.pushSubscriptions ||= [];
  database.users ||= [];
  if (database.users.length === 0 && process.env.ADMIN_PASSWORD) {
    database.users.push({ id: randomBytes(12).toString('hex'), name: 'Administración', username: 'admin', role: 'owner', passwordHash: hashPassword(process.env.ADMIN_PASSWORD), active: true });
    await saveDatabase();
  }
  return database;
}

function saveDatabase() {
  const snapshot = JSON.stringify(database, null, 2);
  writeQueue = writeQueue.then(async () => {
    await mkdir(resolve(dataPath, '..'), { recursive: true });
    const temporary = `${dataPath}.${process.pid}.tmp`;
    await writeFile(temporary, snapshot, { mode: 0o600 });
    await rename(temporary, dataPath);
  });
  return writeQueue;
}

function json(res, status, value, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(value));
}

async function bodyJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100_000) throw Object.assign(new Error('Solicitud demasiado grande'), { status: 413 });
  }
  try { return JSON.parse(body || '{}'); }
  catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}

function cookie(req, name) {
  return (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function secureCookie(req) {
  return req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
}

function isAdmin(req) {
  const token = cookie(req, 'portal_session');
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) { sessions.delete(token); return null; }
  return database?.users.find(user => user.id === session.userId && user.active) || null;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  return origin === `http://${host}` || origin === `https://${host}`;
}

function validateAnnouncement(input) {
  const title = String(input.title || '').trim();
  const summary = String(input.summary || '').trim();
  const body = String(input.body || '').trim();
  const category = String(input.category || '');
  const status = String(input.status || 'draft');
  const priority = String(input.priority || 'normal');
  const eventDate = String(input.eventDate || '');
  if (!title || title.length > 140 || !summary || summary.length > 280 || !body || body.length > 8000) throw Object.assign(new Error('Completa título, resumen y contenido dentro de los límites indicados.'), { status: 400 });
  if (!categories.includes(category) || !['draft', 'pending', 'rejected', 'published', 'archived'].includes(status) || !['normal', 'urgent'].includes(priority)) throw Object.assign(new Error('Categoría, estado o prioridad inválidos.'), { status: 400 });
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw Object.assign(new Error('Fecha inválida.'), { status: 400 });
  return { title, summary, body, category, status, priority, eventDate };
}

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM_EMAIL && process.env.PUBLIC_BASE_URL);
}

async function sendEmail(to, subject, html) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM_EMAIL, to: [to], subject, html })
  });
  if (!response.ok) throw new Error(`El proveedor de correo devolvió ${response.status}`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function notifySubscribers(item) {
  const delivery = { emailSent: 0, emailFailed: 0, pushSent: 0, pushFailed: 0 };
  const subscribers = emailConfigured() ? database.subscribers.filter(sub => sub.confirmed && sub.categories.includes(item.category)) : [];
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  for (const sub of subscribers) {
    const link = `${base}/?aviso=${encodeURIComponent(item.id)}`;
    const unsubscribe = `${base}/api/subscriptions/unsubscribe?token=${encodeURIComponent(sub.unsubscribeToken)}`;
    try {
      await sendEmail(sub.email, `Nuevo aviso de Derecho UDA: ${item.title}`,
        `<p>${escapeHtml(item.summary)}</p><p><a href="${escapeHtml(link)}">Leer aviso</a></p><p><small><a href="${escapeHtml(unsubscribe)}">Dejar de recibir estos correos</a></small></p>`);
      delivery.emailSent++;
    } catch (error) { delivery.emailFailed++; console.error('Error de envío:', error.message); }
  }
  if (pushConfigured()) {
    for (const sub of database.pushSubscriptions.filter(sub => sub.categories.includes(item.category))) {
      try {
        await webPush.sendNotification(sub.subscription, JSON.stringify({ title: item.title, body: item.summary, url: `/?aviso=${encodeURIComponent(item.id)}`, tag: item.id }), { TTL: 86400, urgency: item.priority === 'urgent' ? 'high' : 'normal' });
        delivery.pushSent++;
      } catch (error) {
        delivery.pushFailed++;
        if ([404, 410].includes(error.statusCode)) database.pushSubscriptions = database.pushSubscriptions.filter(entry => entry.endpoint !== sub.endpoint);
        console.error('Error de notificación push:', error.message);
      }
    }
    if (delivery.pushFailed) await saveDatabase();
  }
  return delivery;
}

async function serveStatic(req, res, pathname) {
  const routes = { '/': 'index.html', '/admin': 'admin.html' };
  const file = routes[pathname] || pathname.slice(1);
  if (!file || file.includes('..') || file.startsWith('.') || file.includes('\\')) return json(res, 404, { error: 'No encontrado' });
  const path = resolve(publicRoot, file);
  if (!path.startsWith(publicRoot)) return json(res, 404, { error: 'No encontrado' });
  try {
    const content = await readFile(path);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, 404, { error: 'No encontrado' });
    throw error;
  }
}

export async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    if (req.method === 'GET' && path === '/api/config') return json(res, 200, { emailNotifications: emailConfigured(), pushNotifications: pushConfigured(), vapidPublicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null, adminEnabled: Boolean(process.env.ADMIN_PASSWORD), categories });
    if (req.method === 'GET' && path === '/api/announcements') {
      const db = await getDatabase();
      return json(res, 200, db.announcements.filter(item => item.status === 'published').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map(item => ({ id: item.id, title: item.title, summary: item.summary, body: item.body, category: item.category, priority: item.priority, eventDate: item.eventDate, publishedAt: item.publishedAt, demo: item.demo })));
    }
    if (req.method === 'GET' && path === '/api/session') {
      await getDatabase();
      const user = isAdmin(req);
      return json(res, 200, { authenticated: Boolean(user), enabled: database.users.length > 0, user: user ? { id: user.id, name: user.name, username: user.username, role: user.role } : null });
    }
    if (req.method === 'GET' && path === '/api/admin/announcements') {
      await getDatabase();
      if (!isAdmin(req)) return json(res, 401, { error: 'Acceso no autorizado' });
      return json(res, 200, (await getDatabase()).announcements.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    }
    if (req.method === 'GET' && path === '/api/admin/users') {
      await getDatabase();
      const user = isAdmin(req);
      if (!user || user.role !== 'owner') return json(res, 403, { error: 'Solo administración puede gestionar cuentas.' });
      return json(res, 200, database.users.map(({ passwordHash, ...account }) => account));
    }
    if (req.method === 'GET' && path === '/api/subscriptions/confirm') {
      const db = await getDatabase();
      const token = url.searchParams.get('token');
      const sub = token ? db.subscribers.find(item => item.confirmToken === token) : null;
      if (!sub) return redirect(res, '/?suscripcion=invalida');
      sub.confirmed = true; sub.confirmToken = null;
      await saveDatabase();
      return redirect(res, '/?suscripcion=confirmada');
    }
    if (req.method === 'GET' && path === '/api/subscriptions/unsubscribe') {
      const db = await getDatabase();
      db.subscribers = db.subscribers.filter(item => item.unsubscribeToken !== url.searchParams.get('token'));
      await saveDatabase();
      return redirect(res, '/?suscripcion=baja');
    }
    if (req.method === 'GET') return serveStatic(req, res, path);
    if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' });

    if (req.method === 'POST' && path === '/api/login') {
      const db = await getDatabase();
      if (db.users.length === 0) return json(res, 503, { error: 'Panel no configurado' });
      const ip = req.socket.remoteAddress || 'unknown';
      const attempt = loginAttempts.get(ip) || { count: 0, until: 0 };
      if (attempt.until > Date.now()) return json(res, 429, { error: 'Demasiados intentos. Intenta más tarde.' });
      const credentials = await bodyJson(req);
      const username = String(credentials.username || '').trim().toLowerCase();
      const password = String(credentials.password || '');
      const user = db.users.find(account => account.username === username && account.active);
      const valid = Boolean(user && passwordMatches(password, user.passwordHash));
      if (!valid) {
        attempt.count++;
        if (attempt.count >= 5) { attempt.count = 0; attempt.until = Date.now() + 15 * 60_000; }
        loginAttempts.set(ip, attempt);
        return json(res, 401, { error: 'Clave incorrecta' });
      }
      loginAttempts.delete(ip);
      const token = randomBytes(32).toString('hex');
      sessions.set(token, { userId: user.id, expires: Date.now() + 12 * 60 * 60_000 });
      return json(res, 200, { authenticated: true, user: { id: user.id, name: user.name, username: user.username, role: user.role } }, { 'Set-Cookie': `portal_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=43200${secureCookie(req)}` });
    }
    if (req.method === 'POST' && path === '/api/logout') {
      sessions.delete(cookie(req, 'portal_session'));
      return json(res, 200, { authenticated: false }, { 'Set-Cookie': `portal_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secureCookie(req)}` });
    }
    if (req.method === 'POST' && path === '/api/subscriptions') {
      if (!emailConfigured()) return json(res, 503, { error: 'La suscripción por correo aún no está configurada.' });
      const input = await bodyJson(req);
      const email = String(input.email || '').trim().toLowerCase();
      const selected = Array.isArray(input.categories) ? input.categories.filter(category => categories.includes(category)) : [];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || selected.length === 0) return json(res, 400, { error: 'Indica un correo válido y al menos una categoría.' });
      const db = await getDatabase();
      let sub = db.subscribers.find(item => item.email === email);
      const token = randomBytes(24).toString('hex');
      if (sub) { sub.categories = [...new Set(selected)]; sub.confirmed = false; sub.confirmToken = token; }
      else { sub = { email, categories: [...new Set(selected)], confirmed: false, confirmToken: token, unsubscribeToken: randomBytes(24).toString('hex') }; db.subscribers.push(sub); }
      await saveDatabase();
      const link = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/subscriptions/confirm?token=${token}`;
      await sendEmail(email, 'Confirma tus avisos de Derecho UDA', `<p>Confirma tu suscripción al panel informativo:</p><p><a href="${escapeHtml(link)}">Confirmar suscripción</a></p><p>Si no lo solicitaste, ignora este mensaje.</p>`);
      return json(res, 200, { message: 'Revisa tu correo para confirmar la suscripción.' });
    }
    if (req.method === 'POST' && path === '/api/push/subscriptions') {
      if (!pushConfigured()) return json(res, 503, { error: 'Las notificaciones del navegador aún no están configuradas.' });
      const input = await bodyJson(req);
      const subscription = input.subscription;
      const selected = Array.isArray(input.categories) ? input.categories.filter(category => categories.includes(category)) : [];
      if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.endpoint.startsWith('https://') || subscription.endpoint.length > 2500 || !subscription.keys?.p256dh || !subscription.keys?.auth || selected.length === 0) return json(res, 400, { error: 'Suscripción inválida.' });
      const db = await getDatabase();
      db.pushSubscriptions = db.pushSubscriptions.filter(entry => entry.endpoint !== subscription.endpoint);
      db.pushSubscriptions.push({ endpoint: subscription.endpoint, subscription, categories: [...new Set(selected)] });
      await saveDatabase();
      return json(res, 200, { subscribed: true });
    }
    if (req.method === 'POST' && path === '/api/push/unsubscribe') {
      const input = await bodyJson(req);
      const db = await getDatabase();
      db.pushSubscriptions = db.pushSubscriptions.filter(entry => entry.endpoint !== input.endpoint);
      await saveDatabase();
      return json(res, 200, { subscribed: false });
    }
    if (path.startsWith('/api/admin/')) {
      const db = await getDatabase();
      const user = isAdmin(req);
      if (!user) return json(res, 401, { error: 'Acceso no autorizado' });
      if (req.method === 'POST' && path === '/api/admin/users') {
        if (user.role !== 'owner') return json(res, 403, { error: 'Solo administración puede gestionar cuentas.' });
        const input = await bodyJson(req);
        const username = String(input.username || '').trim().toLowerCase();
        const name = String(input.name || '').trim();
        const password = String(input.password || '');
        const role = String(input.role || '');
        if (!/^[a-z0-9._-]{3,40}$/.test(username) || !name || name.length > 80 || password.length < 12 || !['editor', 'approver'].includes(role)) return json(res, 400, { error: 'Revisa nombre, usuario, rol y clave (mínimo 12 caracteres).' });
        if (db.users.some(account => account.username === username)) return json(res, 409, { error: 'Ese usuario ya existe.' });
        const account = { id: randomBytes(12).toString('hex'), username, name, role, passwordHash: hashPassword(password), active: true };
        db.users.push(account);
        await saveDatabase();
        return json(res, 201, { id: account.id, username, name, role, active: true });
      }
      const id = path.split('/')[4];
      if (req.method === 'POST' && path === '/api/admin/announcements') {
        const values = validateAnnouncement({ ...(await bodyJson(req)), status: 'draft' });
        const now = new Date().toISOString();
        const item = { id: randomBytes(12).toString('hex'), ...values, authorId: user.id, authorName: user.name, reviewerId: null, rejectionNote: '', submittedAt: null, publishedAt: null, updatedAt: now, demo: false };
        db.announcements.push(item);
        await saveDatabase();
        return json(res, 201, { item });
      }
      if (id && ['PUT', 'DELETE', 'POST'].includes(req.method)) {
        const index = db.announcements.findIndex(item => item.id === id);
        if (index < 0) return json(res, 404, { error: 'Aviso no encontrado' });
        const previous = db.announcements[index];
        const reviewer = ['owner', 'approver'].includes(user.role);
        const author = previous.authorId === user.id;
        if (!reviewer && !author) return json(res, 403, { error: 'No puedes modificar este aviso.' });
        if (req.method === 'DELETE') {
          if (!['draft', 'rejected'].includes(previous.status) && user.role !== 'owner') return json(res, 403, { error: 'No puedes eliminar un aviso publicado o en revisión.' });
          db.announcements.splice(index, 1);
          await saveDatabase();
          return json(res, 200, { deleted: true });
        }
        if (req.method === 'POST') {
          const action = path.split('/')[5];
          if (action === 'submit' && author && ['draft', 'rejected'].includes(previous.status)) {
            previous.status = 'pending'; previous.submittedAt = new Date().toISOString(); previous.rejectionNote = ''; previous.updatedAt = previous.submittedAt;
            await saveDatabase();
            return json(res, 200, { item: previous });
          }
          if (action === 'approve' && reviewer && previous.status === 'pending' && previous.authorId !== user.id) {
            previous.status = 'published'; previous.reviewerId = user.id; previous.publishedAt = new Date().toISOString(); previous.updatedAt = previous.publishedAt;
            await saveDatabase();
            const delivery = await notifySubscribers(previous);
            return json(res, 200, { item: previous, delivery });
          }
          if (action === 'reject' && reviewer && previous.status === 'pending' && previous.authorId !== user.id) {
            const note = String((await bodyJson(req)).note || '').trim();
            if (!note || note.length > 500) return json(res, 400, { error: 'Indica el motivo de la devolución.' });
            previous.status = 'rejected'; previous.reviewerId = user.id; previous.rejectionNote = note; previous.updatedAt = new Date().toISOString();
            await saveDatabase();
            return json(res, 200, { item: previous });
          }
          if (action === 'archive' && reviewer && previous.status === 'published') {
            previous.status = 'archived'; previous.updatedAt = new Date().toISOString();
            await saveDatabase();
            return json(res, 200, { item: previous });
          }
          return json(res, 403, { error: 'Acción no permitida en el estado actual.' });
        }
        if (!reviewer && !['draft', 'rejected'].includes(previous.status)) return json(res, 403, { error: 'El aviso está en revisión o publicado.' });
        const values = validateAnnouncement({ ...(await bodyJson(req)), status: previous.status === 'rejected' ? 'draft' : previous.status });
        const now = new Date().toISOString();
        const item = { ...previous, ...values, updatedAt: now, rejectionNote: previous.status === 'rejected' ? '' : previous.rejectionNote };
        db.announcements[index] = item;
        await saveDatabase();
        return json(res, 200, { item });
      }
    }
    return json(res, 404, { error: 'No encontrado' });
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.status ? error.message : 'Ocurrió un error en el servidor.' });
  }
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  http.createServer(handler).listen(port, () => console.log(`Portal disponible en http://localhost:${port}`));
}
