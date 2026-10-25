import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cloudHandler } from '../lib/cloud.mjs';

process.loadEnvFile('.env.cloud');
const accounts = JSON.parse(await readFile('data/cloud-credentials.json','utf8'));
async function call(path, method='GET', body, cookie) {
  const origin = process.env.CLOUD_TEST_URL || 'https://portal.test';
  const request = new Request(`${origin}${path}`,{method,headers:{...(cookie?{Cookie:cookie}:{}),Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const response = process.env.CLOUD_TEST_URL ? await fetch(request) : await cloudHandler(request);
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(role) {
  const account = accounts.find(a=>a.role===role);
  const result = await call('/api/login','POST',{username:account.email,password:account.password});
  assert.equal(result.status,200,'Supabase Auth login');
  assert.equal(result.body.user.role,role);
  return result.cookie;
}

const editor = await login('editor');
const approver = await login('approver');
const values = {title:`Prueba técnica ${Date.now()}`,summary:'Prueba automatizada del flujo editorial opcional.',body:'Aviso temporal de prueba; queda archivado al terminar.',category:'General',priority:'normal',eventDate:''};

// Camino 1: Secretaría publica directamente.
const direct = await call('/api/admin/announcements','POST',{...values,title:`${values.title} · directa`},editor);
assert.equal(direct.status,201);
const directRoute = `/api/admin/announcements/${direct.body.item.id}`;
assert.equal((await call(`${directRoute}/approve`,'POST',{},editor)).status,200);
assert.equal((await call('/api/announcements')).body.some(item=>item.id===direct.body.item.id),true);
assert.equal((await call(`${directRoute}/archive`,'POST',{},editor)).status,200);

// Camino 2: Secretaría pide revisión y Aprobador publica.
const reviewed = await call('/api/admin/announcements','POST',{...values,title:`${values.title} · revisada`},editor);
assert.equal(reviewed.status,201);
const reviewedRoute = `/api/admin/announcements/${reviewed.body.item.id}`;
assert.equal((await call(`${reviewedRoute}/submit`,'POST',{},editor)).status,200);
assert.equal((await call(reviewedRoute,'PUT',{...values,title:'Edición bloqueada durante revisión'},editor)).status,403);
assert.equal((await call(`${reviewedRoute}/approve`,'POST',{},approver)).status,200);
assert.equal((await call(`${reviewedRoute}/approve`,'POST',{},approver)).status,403);
const visible = (await call('/api/announcements')).body.find(item=>item.id===reviewed.body.item.id);
assert.ok(visible);
assert.equal('authorId' in visible,false);
assert.equal((await call(`${reviewedRoute}/archive`,'POST',{},editor)).status,200);

await call('/api/logout','POST',{},editor);
await call('/api/logout','POST',{},approver);
console.log('Supabase verificado: publicación directa de Secretaría y revisión opcional con Aprobador.');