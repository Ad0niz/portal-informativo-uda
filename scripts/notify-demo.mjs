// Sends real notifications to subscribed test devices/addresses in General.
// Run only after the user authorizes the test and confirms its recipients.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.loadEnvFile('.env.cloud');
const base = process.env.PUBLIC_BASE_URL;
if (base !== 'https://portal-informativo-uda.vercel.app') throw new Error('La prueba solo se permite en el portal demo.');
const accounts = JSON.parse(await readFile('data/cloud-credentials.json','utf8'));
async function api(path, body, cookie) {
  const response = await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body || {})});
  const result = await response.json();
  if (!response.ok) throw new Error(`Prueba falló (${response.status}): ${result.error || 'API'}`);
  return {result,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(role) {
  const account = accounts.find(a=>a.role===role);
  return (await api('/api/login',{username:account.email,password:account.password})).cookie;
}
const editor = await login('editor');
const approver = await login('approver');
try {
  const {result:{item}} = await api('/api/admin/announcements',{
    title:'Prueba de notificaciones del portal',summary:'Si recibiste este aviso, la prueba de notificaciones llegó a tu dispositivo.',
    body:'Este es un aviso de prueba. Puedes hacer clic en la notificación para abrir esta publicación. No comunica cambios de clases ni evaluaciones reales.',
    category:'General',priority:'normal',eventDate:''
  },editor);
  assert.equal(item.status,'draft');
  const route = `/api/admin/announcements/${item.id}`;
  await api(`${route}/submit`,{},editor);
  const {result} = await api(`${route}/approve`,{},approver);
  console.log(JSON.stringify({url:`${base}/?aviso=${item.id}`,delivery:result.delivery}));
} finally {
  await api('/api/logout',{},editor);
  await api('/api/logout',{},approver);
}
