const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const reply = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY);
const eq = value => `eq.${encodeURIComponent(value)}`;

async function supabase(path, { method = 'GET', body, accessToken, privileged = true, prefer } = {}) {
  const key = privileged ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PUBLISHABLE_KEY;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else if (privileged && key?.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.code === '23505') fail(409, 'Ese correo ya tiene una cuenta asociada.');
    if (response.status === 429) fail(429, 'Demasiados intentos. Espera unos minutos.');
    console.error('Supabase account request failed', { status: response.status, code: data?.code });
    fail(502, 'No fue posible completar la operación administrativa.');
  }
  return data;
}

function accessCookie(request) {
  return (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith('portal_access='))?.slice(14);
}

async function currentOwner(request) {
  const accessToken = accessCookie(request);
  if (!accessToken) fail(401, 'Ingresa al panel para continuar.');
  let auth;
  try {
    auth = await supabase('/auth/v1/user', { privileged: false, accessToken });
  } catch {
    fail(401, 'La sesión no es válida. Vuelve a ingresar.');
  }
  const people = await supabase(`/rest/v1/portal_profiles?id=${eq(auth.id)}&active=eq.true&select=id,name,email,role,position`);
  const person = people?.[0];
  if (!person || person.role !== 'owner') fail(403, 'Solo Administración puede acceder a esta sección.');
  return person;
}

async function input(request) {
  if (Number(request.headers.get('content-length')) > 100000) fail(413, 'Solicitud demasiado grande.');
  try {
    return await request.json();
  } catch {
    fail(400, 'JSON inválido.');
  }
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function handlesAccountRequest(request) {
  return ['/api/admin/accounts', '/api/admin/subscribers'].includes(new URL(request.url).pathname);
}

export async function accountHandler(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (!['GET', 'POST', 'DELETE'].includes(method)) return reply({ error: 'Método no permitido.' }, 405);
    if (method !== 'GET') {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) fail(403, 'Origen no permitido.');
    }
    if (!configured()) fail(503, 'Falta completar la conexión con Supabase.');
    await currentOwner(request);

    if (path === '/api/admin/subscribers') {
      if (method === 'GET') {
        const subscribers = await supabase('/rest/v1/portal_email_subscriptions?select=email,categories,confirmed,updatedAt&order=updatedAt.desc');
        return reply(subscribers);
      }
      if (method === 'DELETE') {
        const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
        if (!validEmail(email)) fail(400, 'Indica un correo válido para eliminar.');
        await supabase(`/rest/v1/portal_email_subscriptions?email=${eq(email)}`, { method: 'DELETE' });
        await supabase(`/rest/v1/portal_delivery_jobs?channel=eq.email&recipient=${eq(email)}&state=neq.sent`, { method: 'DELETE' });
        return reply({ removed: true, email });
      }
      return reply({ error: 'Método no permitido.' }, 405);
    }

    if (method === 'GET') {
      const users = await supabase('/rest/v1/portal_profiles?select=id,name,email,role,active,position,mustChangePassword&order=name.asc');
      return reply(users.map(person => ({ ...person, username: person.email })));
    }
    if (method !== 'POST') return reply({ error: 'Método no permitido.' }, 405);

    const body = await input(request);
    const email = String(body.username || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const position = String(body.position || '').trim();
    const role = String(body.role || '');
    const password = typeof body.password === 'string' ? body.password : '';

    if (!validEmail(email) || !name || name.length > 80 || position.length > 80 || password.length < 8 || password.length > 128 || !['owner', 'editor', 'approver'].includes(role)) {
      fail(400, 'Revisa el correo, nombre, cargo, rol y clave (8 a 128 caracteres).');
    }

    const account = await supabase('/auth/v1/admin/users', {
      method: 'POST',
      body: { email, password, email_confirm: true }
    });

    try {
      await supabase('/rest/v1/portal_profiles', {
        method: 'POST',
        body: { id: account.id, email, name, role, position, mustChangePassword: true }
      });
    } catch (error) {
      await supabase(`/auth/v1/admin/users/${account.id}`, { method: 'DELETE' }).catch(() => {});
      throw error;
    }

    return reply({ id: account.id, username: email, email, name, role, position, mustChangePassword: true, active: true }, 201);
  } catch (error) {
    if (!error.status) console.error('Administrative handler failed', { name: error.name });
    return reply({ error: error.status ? error.message : 'Ocurrió un error. Intenta nuevamente.' }, error.status || 500);
  }
}
