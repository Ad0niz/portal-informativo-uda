const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const reply = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY);
const eq = value => `eq.${encodeURIComponent(value)}`;

function accessCookie(request) {
  return (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith('portal_access='))?.slice(14);
}

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
    if (response.status === 429) fail(429, 'Demasiados intentos. Espera unos minutos.');
    if (path.startsWith('/auth/')) fail(response.status === 401 ? 401 : 400, data?.message || data?.msg || 'No fue posible actualizar la contraseña.');
    console.error('Supabase password request failed', { status: response.status, code: data?.code });
    fail(502, 'No fue posible completar la operación.');
  }
  return data;
}

async function currentProfile(request, required = true) {
  const accessToken = accessCookie(request);
  if (!accessToken) {
    if (required) fail(401, 'Ingresa al panel para continuar.');
    return null;
  }
  let auth;
  try {
    auth = await supabase('/auth/v1/user', { privileged: false, accessToken });
  } catch (error) {
    if (!required && error.status === 401) return null;
    throw error;
  }
  const profiles = await supabase(`/rest/v1/portal_profiles?id=${eq(auth.id)}&active=eq.true&select=id,name,email,role,position,mustChangePassword`);
  const profile = profiles?.[0];
  if (!profile) {
    if (required) fail(403, 'Esta cuenta no tiene acceso al panel.');
    return null;
  }
  return { profile, accessToken };
}

async function readInput(request) {
  if (Number(request.headers.get('content-length')) > 100000) fail(413, 'Solicitud demasiado grande.');
  try {
    return await request.json();
  } catch {
    fail(400, 'JSON inválido.');
  }
}

export function handlesPasswordRequest(request) {
  return ['/api/password-status', '/api/change-password'].includes(new URL(request.url).pathname);
}

export async function passwordHandler(request) {
  try {
    if (!configured()) fail(503, 'Falta completar la conexión con Supabase.');
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === '/api/password-status') {
      if (method !== 'GET') return reply({ error: 'Método no permitido.' }, 405);
      const current = await currentProfile(request);
      return reply({ required: Boolean(current.profile.mustChangePassword) });
    }

    if (path === '/api/change-password') {
      if (method !== 'POST') return reply({ error: 'Método no permitido.' }, 405);
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) fail(403, 'Origen no permitido.');
      const current = await currentProfile(request);
      if (!current.profile.mustChangePassword) fail(409, 'Esta cuenta ya completó el cambio de contraseña inicial.');

      const body = await readInput(request);
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length < 8 || password.length > 128) fail(400, 'La nueva contraseña debe tener entre 8 y 128 caracteres.');

      await supabase('/auth/v1/user', {
        method: 'PUT',
        privileged: false,
        accessToken: current.accessToken,
        body: { password }
      });
      await supabase(`/rest/v1/portal_profiles?id=${eq(current.profile.id)}`, {
        method: 'PATCH',
        body: { mustChangePassword: false },
        prefer: 'return=minimal'
      });

      return reply({ ok: true });
    }

    return reply({ error: 'Ruta no encontrada.' }, 404);
  } catch (error) {
    if (!error.status) console.error('Password handler failed', { name: error.name });
    return reply({ error: error.status ? error.message : 'Ocurrió un error. Intenta nuevamente.' }, error.status || 500);
  }
}

export async function enforcePasswordChange(request) {
  try {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/admin/')) return null;
    if (!configured()) return null;
    const current = await currentProfile(request, false);
    if (current?.profile?.mustChangePassword) {
      return reply({ error: 'Debes cambiar tu contraseña inicial antes de continuar.' }, 403);
    }
    return null;
  } catch (error) {
    if (error.status === 401) return null;
    return reply({ error: error.status ? error.message : 'No fue posible validar la cuenta.' }, error.status || 500);
  }
}
