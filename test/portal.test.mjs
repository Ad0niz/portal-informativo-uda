import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('redacción, revisión y publicación requieren dos cuentas distintas', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portal-uda-'));
  process.env.DATA_PATH = join(directory, 'portal.json');
  process.env.ADMIN_PASSWORD = 'clave-inicial-segura-2026';
  const { handler } = await import('../server.mjs');
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, method = 'GET', data, cookie) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined, redirect: 'manual' });
    const body = await response.json();
    return { status: response.status, body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const login = async (username, password) => request('/api/login', 'POST', { username, password });
  const account = (username, role) => ({ username, name: username, role, password: `contraseña-${username}-2026` });
  const content = { title: 'Cambio de sala de prueba', summary: 'La clase se realizará en otra sala.', body: 'Sala A-12, martes a las 10:00.', category: 'Salas', priority: 'normal', eventDate: '' };
  try {
    const initial = await request('/api/announcements');
    assert.equal(initial.status, 200);
    assert.equal(initial.body.length, 3);
    assert.equal((await login('admin', 'incorrecta')).status, 401);
    const owner = await login('admin', process.env.ADMIN_PASSWORD);
    assert.equal(owner.status, 200);
    const editorAccount = await request('/api/admin/users', 'POST', account('redactor', 'editor'), owner.cookie);
    const reviewerAccount = await request('/api/admin/users', 'POST', account('aprobador', 'approver'), owner.cookie);
    assert.equal(editorAccount.status, 201);
    assert.equal(reviewerAccount.status, 201);
    const editor = await login('redactor', account('redactor', 'editor').password);
    const reviewer = await login('aprobador', account('aprobador', 'approver').password);
    const created = await request('/api/admin/announcements', 'POST', content, editor.cookie);
    assert.equal(created.status, 201);
    const id = created.body.item.id;
    assert.equal((await request('/api/announcements')).body.length, 3);
    assert.equal((await request(`/api/admin/announcements/${id}/submit`, 'POST', undefined, editor.cookie)).body.item.status, 'pending');
    assert.equal((await request(`/api/admin/announcements/${id}/approve`, 'POST', undefined, editor.cookie)).status, 403);
    assert.equal((await request('/api/announcements')).body.length, 3);
    const approved = await request(`/api/admin/announcements/${id}/approve`, 'POST', undefined, reviewer.cookie);
    assert.equal(approved.status, 200);
    assert.equal(approved.body.item.status, 'published');
    const publicItems = await request('/api/announcements');
    assert.equal(publicItems.body.length, 4);
    assert.equal(publicItems.body[0].title, content.title);
    assert.equal('authorId' in publicItems.body[0], false);
    const second = await request('/api/admin/announcements', 'POST', { ...content, title: 'Segundo aviso' }, reviewer.cookie);
    const secondId = second.body.item.id;
    assert.equal((await request(`/api/admin/announcements/${secondId}/submit`, 'POST', undefined, reviewer.cookie)).status, 200);
    assert.equal((await request(`/api/admin/announcements/${secondId}/approve`, 'POST', undefined, reviewer.cookie)).status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
