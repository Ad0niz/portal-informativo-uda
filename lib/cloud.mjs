import { randomBytes } from 'node:crypto';
import webPush from 'web-push';
import { emailConfigured, sendEmail } from './email.mjs';

const categories = ['Clases', 'Evaluaciones', 'Salas', 'Convocatorias', 'General'];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const reply = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const token = () => randomBytes(32).toString('hex');
const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY);
const pushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
const publicFields = 'id,title,summary,body,category,priority,eventDate,publishedAt,demo';

async function supabase(path, { method = 'GET', body, accessToken, privileged = true, prefer } = {}) {
  const key = privileged ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PUBLISHABLE_KEY;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  // Legacy service_role keys require bearer auth. Modern secret keys use apikey.
  else if (privileged && key?.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.code === '42501') fail(403, 'Acción no permitida en el estado actual.');
    if (data?.code === 'P0002') fail(404, 'Aviso no encontrado.');
    if (data?.code === '23505') fail(409, 'Ese registro ya existe.');
    if (response.status === 429) fail(429, 'Demasiados intentos. Espera unos minutos.');
    if ([400, 401, 403, 422].includes(response.status) && path.startsWith('/auth/')) fail(401, 'No fue posible autenticar la cuenta. Revisa los datos.');
    console.error('Supabase request failed', { status: response.status, code: data?.code });
    fail(502, 'No fue posible completar la operación en la base de datos.');
  }
  return data;
}

const table = (name, query = '', options) => supabase(`/rest/v1/portal_${name}${query ? `?${query}` : ''}`, options);
const eq = value => `eq.${encodeURIComponent(value)}`;
function accessCookie(request) {
  return (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith('portal_access='))?.slice(14);
}
function sessionCookie(request, value, age) {
  return `portal_access=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
async function identity(request, required = true) {
  const accessToken = accessCookie(request);
  if (!accessToken) { if (required) fail(401, 'Ingresa al panel para continuar.'); return null; }
  let auth;
  try { auth = await supabase('/auth/v1/user', { privileged: false, accessToken }); }
  catch (error) { if (!required && error.status === 401) return null; throw error; }
  const [person] = await table('profiles', `id=${eq(auth.id)}&active=eq.true&select=id,name,email,role`);
  if (!person) { if (required) fail(403, 'Esta cuenta no tiene acceso al panel.'); return null; }
  return { ...person, username: person.email };
}
async function input(request) {
  if (Number(request.headers.get('content-length')) > 100000) fail(413, 'Solicitud demasiado grande.');
  const reader = request.body?.getReader();
  if (!reader) return {};
  let size = 0;
  const chunks = [];
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > 100000) { await reader.cancel(); fail(413, 'Solicitud demasiado grande.'); }
    chunks.push(chunk.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { fail(400, 'JSON inválido.'); }
}
function noticeValues(body) {
  const result = {};
  for (const [key, max] of [['title',140], ['summary',280], ['body',8000]]) {
    result[key] = String(body[key] || '').trim();
    if (!result[key] || result[key].length > max) fail(400, 'Completa título, resumen y contenido dentro de sus límites.');
  }
  if (!categories.includes(body.category) || !['normal','urgent'].includes(body.priority)) fail(400, 'Categoría o prioridad inválida.');
  const date = String(body.eventDate || '');
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)) fail(400, 'Fecha inválida.');
  return { ...result, category: body.category, priority: body.priority, eventDate: date };
}
function selectedCategories(body) {
  const selected = [...new Set(Array.isArray(body.categories) ? body.categories.filter(category => categories.includes(category)) : [])];
  if (!selected.length) fail(400, 'Selecciona al menos una categoría.');
  return selected;
}
export function validPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
    return ['fcm.googleapis.com','jmt17.google.com','updates.push.services.mozilla.com','push.services.mozilla.com','notify.windows.com','push.apple.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

// Jobs are committed in the same transaction as publication. A failed request
// can be retried from the admin panel without losing its recipient list.
async function deliver(item) {
  const result = { emailSent: 0, pushSent: 0, emailFailed: 0, pushFailed: 0, pending: 0 };
  const stale = new Date(Date.now() - 120000).toISOString();
  const jobs = await table('delivery_jobs', `announcement_id=${eq(item.id)}&or=(state.in.(pending,failed),and(state.eq.sending,updated_at.lt.${stale}))&limit=3&order=updated_at.asc`);
  if (pushConfigured()) webPush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  for (const job of jobs) {
    if ((job.channel === 'email' && !emailConfigured()) || (job.channel === 'push' && !pushConfigured())) { result.pending++; continue; }
    const [claimed] = await table('delivery_jobs', `id=${eq(job.id)}&state=${eq(job.state)}&updated_at=${eq(job.updated_at)}`, {
      method: 'PATCH', prefer: 'return=representation', body: { state: 'sending', attempts: job.attempts + 1, updated_at: new Date().toISOString() }
    });
    if (!claimed) continue;
    try {
      if (job.channel === 'email') {
        const [sub] = await table('email_subscriptions', `email=${eq(job.recipient)}&confirmed=eq.true`);
        if (!sub || !sub.categories.includes(item.category)) {
          await table('delivery_jobs', `id=${eq(job.id)}`, { method: 'DELETE' });
          continue;
        }
        const base = process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
        await sendEmail(sub.email, `Nuevo aviso de Derecho UDA: ${item.title}`, `<p>${escapeHtml(item.summary)}</p><p><a href="${escapeHtml(`${base}/?aviso=${item.id}`)}">Leer aviso</a></p><p><a href="${escapeHtml(`${base}/api/subscriptions/unsubscribe?token=${sub.unsubscribeToken}`)}">Dejar de recibir correos</a></p>`, job.id);
      } else {
        const [sub] = await table('push_subscriptions', `endpoint=${eq(job.recipient)}`);
        if (!sub || !sub.categories.includes(item.category)) {
          await table('delivery_jobs', `id=${eq(job.id)}`, { method: 'DELETE' });
          continue;
        }
        if (!validPushEndpoint(sub.endpoint)) throw new Error('invalid_endpoint');
        await webPush.sendNotification(sub.subscription, JSON.stringify({ title: item.title, body: item.summary, url: `/?aviso=${item.id}`, tag: item.id }), { TTL: 86400, timeout: 8000 });
      }
      await table('delivery_jobs', `id=${eq(job.id)}`, { method: 'PATCH', body: { state: 'sent', last_error: null, updated_at: new Date().toISOString() } });
      result[job.channel === 'email' ? 'emailSent' : 'pushSent']++;
    } catch (error) {
      result[job.channel === 'email' ? 'emailFailed' : 'pushFailed']++;
      if (job.channel === 'push' && [404,410].includes(error.statusCode)) {
        await table('push_subscriptions', `endpoint=${eq(job.recipient)}`, { method: 'DELETE' });
        await table('delivery_jobs', `id=${eq(job.id)}`, { method: 'DELETE' });
      } else {
        await table('delivery_jobs', `id=${eq(job.id)}`, { method: 'PATCH', body: { state: 'failed', last_error: 'delivery_failed', updated_at: new Date().toISOString() } });
      }
    }
  }
  const remaining = await table('delivery_jobs', `announcement_id=${eq(item.id)}&state=neq.sent&select=id`);
  result.pending = remaining.length;
  return result;
}

export async function cloudHandler(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (!['GET','POST','PUT','DELETE'].includes(method)) return reply({ error: 'Método no permitido.' },405);
    if (method !== 'GET') {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) fail(403, 'Origen no permitido.');
    }
    if (path === '/api/config' && method === 'GET') return reply({ categories, authMode: 'supabase', adminEnabled: configured(), emailNotifications: emailConfigured(), emailTestMode: false, pushNotifications: pushConfigured(), vapidPublicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
    if (!configured()) fail(503, 'Falta completar la conexión con Supabase.');
    if (path === '/api/announcements' && method === 'GET') return reply(await table('announcements', `status=eq.published&select=${publicFields}&order=publishedAt.desc&limit=200`));
    if (path === '/api/session' && method === 'GET') {
      const user = await identity(request, false);
      return reply({ authenticated: Boolean(user), enabled: true, user });
    }
    if (path === '/api/login' && method === 'POST') {
      const body = await input(request);
      const session = await supabase('/auth/v1/token?grant_type=password', { privileged: false, method: 'POST', body: { email: String(body.username || '').trim().toLowerCase(), password: String(body.password || '') } });
      const [person] = await table('profiles', `id=${eq(session.user.id)}&active=eq.true&select=id,name,email,role`);
      if (!person) fail(403, 'Esta cuenta no tiene acceso al panel.');
      return reply({ user: { ...person, username: person.email } }, 200, { 'Set-Cookie': sessionCookie(request, session.access_token, session.expires_in) });
    }
    if (path === '/api/logout' && method === 'POST') {
      const accessToken = accessCookie(request);
      if (accessToken) await supabase('/auth/v1/logout', { method: 'POST', privileged: false, accessToken }).catch(() => {});
      return reply({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
    }
    if (path.startsWith('/api/admin/')) {
      const user = await identity(request);
      if (path === '/api/admin/users') {
        if (user.role !== 'owner') fail(403, 'Solo administración puede gestionar cuentas.');
        if (method === 'GET') return reply((await table('profiles', 'select=id,name,email,role,active')).map(person => ({ ...person, username: person.email })));
        if (method === 'POST') {
          const body = await input(request);
          const email = String(body.username || '').trim().toLowerCase();
          const name = String(body.name || '').trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !name || name.length>80 || typeof body.password !== 'string' || body.password.length<12 || body.password.length>128 || !['editor','approver'].includes(body.role)) fail(400, 'Revisa el correo, nombre, rol y clave (12 a 128 caracteres).');
          const account = await supabase('/auth/v1/admin/users', { method:'POST', body:{ email, password:body.password, email_confirm:true } });
          try {
            await table('profiles', '', { method:'POST', body:{ id:account.id, email, name, role:body.role } });
          } catch (error) {
            await supabase(`/auth/v1/admin/users/${account.id}`, { method:'DELETE' });
            throw error;
          }
          return reply({ id:account.id, username:email, name, role:body.role },201);
        }
      }
      if (path === '/api/admin/announcements' && method === 'GET') return reply(await table('announcements', `${user.role==='editor' ? `authorId=${eq(user.id)}&` : ''}order=updatedAt.desc&limit=500`));
      if (path === '/api/admin/announcements' && method === 'POST') {
        const values = noticeValues(await input(request));
        const item = await supabase('/rest/v1/rpc/portal_edit_notice', { method:'POST', body:{ actor:user.id, notice_id:null, action:'create', payload:values } });
        return reply({ item },201);
      }
      const match = path.match(/^\/api\/admin\/announcements\/([0-9a-f-]{36})(?:\/(submit|approve|reject|archive|deliver))?$/);
      if (match) {
        const action = method==='PUT' && !match[2] ? 'edit' : method==='DELETE' && !match[2] ? 'delete' : method==='POST' ? match[2] : null;
        if (!action) fail(405, 'Método no permitido.');
        if (action==='deliver') {
          if (!['owner','approver'].includes(user.role)) fail(403,'Solo el equipo de aprobación puede enviar avisos.');
          const [item] = await table('announcements', `id=${eq(match[1])}&status=eq.published`);
          if (!item) fail(404,'Aviso publicado no encontrado.');
          return reply({ item, delivery:await deliver(item) });
        }
        const payload = action==='edit' ? noticeValues(await input(request)) : action==='reject' ? { note:String((await input(request)).note || '').trim() } : {};
        const item = await supabase('/rest/v1/rpc/portal_edit_notice', { method:'POST', body:{ actor:user.id, notice_id:match[1], action, payload } });
        if (action==='delete') return reply(item);
        if (action==='approve') {
          let delivery;
          try { delivery = await deliver(item); }
          catch { delivery = { emailSent:0,pushSent:0,pending:null,error:true }; }
          return reply({ item, delivery });
        }
        return reply({ item });
      }
    }
    if (path==='/api/subscriptions' && method==='POST') {
      if (!emailConfigured()) fail(503,'La suscripción por correo aún no está configurada.');
      const body = await input(request);
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) fail(400,'Indica un correo válido.');
      const chosen = selectedCategories(body);
      const [existing] = await table('email_subscriptions', `email=${eq(email)}`);
      if (existing && Date.now()-Date.parse(existing.updatedAt)<60000) fail(429,'Espera un minuto antes de solicitar otro correo.');
      // Existing confirmed subscriptions are unchanged until the owner follows
      // a fresh confirmation link; do not let strangers change their preferences.
      if (existing?.confirmed) return reply({ message:'Si necesitas cambiar tus preferencias, usa el enlace de baja de uno de tus avisos y suscríbete otra vez.' });
      const confirmToken = token();
      const unsubscribeToken = token();
      await table('email_subscriptions','on_conflict=email',{method:'POST',prefer:'resolution=merge-duplicates',body:{email,categories:chosen,confirmed:false,confirmToken,unsubscribeToken,updatedAt:new Date().toISOString()}});
      const link = `${process.env.PUBLIC_BASE_URL.replace(/\/$/,'')}/api/subscriptions/confirm?token=${confirmToken}`;
      await sendEmail(email,'Confirma tus avisos de Derecho UDA',`<p>Confirma tu suscripción al Panel Informativo de Derecho UDA:</p><p><a href="${escapeHtml(link)}">Confirmar suscripción</a></p><p>Si no lo solicitaste, ignora este mensaje.</p>`);
      return reply({message:'Revisa tu correo para confirmar la suscripción.'});
    }
    if (['/api/subscriptions/confirm','/api/subscriptions/unsubscribe'].includes(path) && method==='GET') {
      const value = url.searchParams.get('token');
      if (!/^[0-9a-f]{64}$/.test(value || '')) return Response.redirect(`${url.origin}/?suscripcion=invalida`,302);
      if (path.endsWith('/confirm')) {
        const changed = await table('email_subscriptions',`confirmToken=${eq(value)}&updatedAt=gt.${new Date(Date.now()-86400000).toISOString()}`,{method:'PATCH',prefer:'return=representation',body:{confirmed:true,confirmToken:null}});
        return Response.redirect(`${url.origin}/?suscripcion=${changed.length?'confirmada':'invalida'}`,302);
      }
      await table('email_subscriptions',`unsubscribeToken=${eq(value)}`,{method:'DELETE'});
      return Response.redirect(`${url.origin}/?suscripcion=baja`,302);
    }
    if (path==='/api/push/subscriptions' && method==='POST') {
      if (!pushConfigured()) fail(503,'Las notificaciones del navegador aún no están configuradas.');
      const body = await input(request);
      const sub = body.subscription;
      const selected = selectedCategories(body);
      if (!sub || typeof sub.endpoint!=='string' || sub.endpoint.length>2500 || !validPushEndpoint(sub.endpoint) || !/^[\w-]{80,100}={0,2}$/.test(sub.keys?.p256dh || '') || !/^[\w-]{20,30}={0,2}$/.test(sub.keys?.auth || '')) {
        let provider = 'invalid-url';
        try { provider = new URL(sub?.endpoint).hostname; } catch {}
        console.warn('Push validation rejected', {provider, endpointLength:sub?.endpoint?.length, p256dhLength:sub?.keys?.p256dh?.length, authLength:sub?.keys?.auth?.length});
        fail(400,'Suscripción del navegador inválida o proveedor no compatible.');
      }
      await table('push_subscriptions','on_conflict=endpoint',{method:'POST',prefer:'resolution=merge-duplicates',body:{endpoint:sub.endpoint,subscription:{endpoint:sub.endpoint,keys:sub.keys},categories:selected,updatedAt:new Date().toISOString()}});
      return reply({subscribed:true});
    }
    if (path==='/api/push/unsubscribe' && method==='POST') {
      const body = await input(request);
      if (typeof body.endpoint!=='string' || !validPushEndpoint(body.endpoint)) fail(400,'Suscripción inválida.');
      await table('push_subscriptions',`endpoint=${eq(body.endpoint)}`,{method:'DELETE'});
      return reply({subscribed:false});
    }
    return reply({error:'No encontrado.'},404);
  } catch (error) {
    if (!error.status) console.error('Portal request failed', { name:error.name });
    return reply({error:error.status ? error.message : 'Ocurrió un error. Intenta nuevamente.'},error.status || 500);
  }
}
