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
const values = {title:`Prueba técnica ${Date.now()}`,summary:'Prueba automatizada del flujo de revisión.',body:'Aviso temporal de prueba; queda archivado al terminar.',category:'General',priority:'normal',eventDate:''};
const created = await call('/api/admin/announcements','POST',values,editor);
assert.equal(created.status,201);
const id = created.body.item.id;
const route = `/api/admin/announcements/${id}`;
assert.equal((await call('/api/announcements')).body.some(item=>item.id===id),false);
assert.equal((await call(`${route}/approve`,'POST',{},editor)).status,403);
assert.equal((await call(`${route}/submit`,'POST',{},editor)).status,200);
assert.equal((await call(route,'PUT',{...values,title:'Edición no permitida'},editor)).status,403);
assert.equal((await call(`${route}/approve`,'POST',{},editor)).status,403);
assert.equal((await call(`${route}/approve`,'POST',{},approver)).status,200);
assert.equal((await call(`${route}/approve`,'POST',{},approver)).status,403);
const visible = (await call('/api/announcements')).body.find(item=>item.id===id);
assert.ok(visible);
assert.equal('authorId' in visible,false);
assert.equal((await call(`${route}/archive`,'POST',{},approver)).status,200);
assert.equal((await call('/api/announcements')).body.some(item=>item.id===id),false);
await call('/api/logout','POST',{},editor);
await call('/api/logout','POST',{},approver);
console.log('Supabase verificado: Auth, roles, borrador privado, revisión, aprobación separada, publicación única y archivo.');
