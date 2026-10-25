import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import webPush from 'web-push';

const root = fileURLToPath(new URL('..', import.meta.url));
const path = join(root, '.env');
try {
  await readFile(path);
  console.error('Ya existe .env; se conserva sin cambios.');
  process.exit(1);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const password = randomBytes(24).toString('base64url');
const keys = webPush.generateVAPIDKeys();
const values = [
  `ADMIN_PASSWORD=${password}`,
  'PUBLIC_BASE_URL=http://localhost:3000',
  'RESEND_API_KEY=',
  'NOTIFY_FROM_EMAIL=',
  `VAPID_PUBLIC_KEY=${keys.publicKey}`,
  `VAPID_PRIVATE_KEY=${keys.privateKey}`,
  'VAPID_SUBJECT=mailto:dev@example.org',
  'PORT=3000',
  ''
].join('\n');
await writeFile(path, values, { flag: 'wx', mode: 0o600 });
console.log('Configuración local creada en .env.');
console.log('Usuario inicial: admin');
console.log(`Clave inicial: ${password}`);
console.log('Antes de publicar, reemplaza VAPID_SUBJECT por un correo de contacto real y configura el envío de correo.');
