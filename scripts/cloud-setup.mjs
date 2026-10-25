import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

process.loadEnvFile(resolve('.env.cloud'));
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (base !== 'https://hfsjubvnyyzcqqsvpiei.supabase.co' || !key) throw new Error('Completa la configuración del proyecto nuevo en .env.cloud.');
const headers = { apikey:key, 'Content-Type':'application/json', ...(key.startsWith('eyJ') ? {Authorization:`Bearer ${key}`} : {}) };
async function api(path, method='GET', body, prefer) {
  const response = await fetch(`${base}${path}`, {method,headers:{...headers,...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const result = await response.json().catch(()=>null);
  if (!response.ok) throw new Error(`Configuración falló: ${response.status} (${result?.code || 'API'}).`);
  return result;
}

// Persist random demo credentials before provisioning so setup is restartable.
const credentialPath = resolve('data/cloud-credentials.json');
let accounts;
try { accounts = JSON.parse(await readFile(credentialPath,'utf8')); }
catch (error) {
  if (error.code!=='ENOENT') throw error;
  accounts = [
    {email:'admin@demo-portal-uda.invalid',name:'Administración demo',role:'owner'},
    {email:'redactor@demo-portal-uda.invalid',name:'Redactor demo',role:'editor'},
    {email:'aprobador@demo-portal-uda.invalid',name:'Aprobador demo',role:'approver'}
  ].map(account=>({...account,password:randomBytes(18).toString('base64url')}));
  await writeFile(credentialPath,JSON.stringify(accounts,null,2),{mode:0o600});
}
const existing = (await api('/auth/v1/admin/users?page=1&per_page=100')).users;
for (const account of accounts) {
  const user = existing.find(user=>user.email===account.email) || await api('/auth/v1/admin/users','POST',{email:account.email,password:account.password,email_confirm:true});
  await api('/rest/v1/portal_profiles?on_conflict=id','POST',{id:user.id,email:account.email,name:account.name,role:account.role},'resolution=merge-duplicates');
}
const notices = await api('/rest/v1/portal_announcements?select=id&limit=1');
if (!notices.length) {
  const now = new Date().toISOString();
  await api('/rest/v1/portal_announcements','POST',[
    {title:'Ejemplo: suspensión de una clase',summary:'Así se verá un aviso de suspensión o cambio de horario.',body:'Aviso ficticio para demostrar el portal. Aquí se indicará el ramo, la sección, el docente y las instrucciones para estudiantes.',category:'Clases',priority:'urgent',status:'published',demo:true,publishedAt:now},
    {title:'Ejemplo: calendario de evaluaciones',summary:'Consulta fechas y cambios de pruebas o entregas.',body:'Aviso ficticio. Las fechas de evaluación reales serán publicadas por el equipo autorizado, después de su revisión.',category:'Evaluaciones',priority:'normal',status:'published',demo:true,publishedAt:now},
    {title:'Ejemplo: cambio de sala',summary:'Los cambios de sala se encuentran fácilmente desde el celular.',body:'Aviso ficticio. Un aviso real incluirá sala original, sala nueva, fecha, horario y sección.',category:'Salas',priority:'normal',status:'published',demo:true,publishedAt:now}
  ]);
}
await writeFile(resolve('demo-credentials.txt'),`CUENTAS DE DEMOSTRACIÓN — PORTAL DERECHO UDA\nGuardar en privado. Estos correos son identificadores ficticios.\n\n${accounts.map(a=>`${a.name}\nCorreo: ${a.email}\nClave: ${a.password}\n`).join('\n')}`,{mode:0o600});
console.log('Tres cuentas y avisos demo preparados. Credenciales guardadas en demo-credentials.txt.');
