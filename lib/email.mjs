import { createHash, createHmac, randomUUID } from 'node:crypto';

const EMAIL_PATH = '/emails:send?api-version=2023-03-31';

function configuration() {
  const connectionString = String(process.env.AZURE_COMMUNICATION_CONNECTION_STRING || '').trim();
  const senderAddress = String(process.env.AZURE_EMAIL_SENDER || '').trim();
  const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (!connectionString || !senderAddress || !publicBaseUrl) return null;

  const parts = {};
  for (const item of connectionString.split(';')) {
    if (!item) continue;
    const separator = item.indexOf('=');
    if (separator <= 0) continue;
    parts[item.slice(0, separator).trim().toLowerCase()] = item.slice(separator + 1).trim();
  }

  if (!parts.endpoint || !parts.accesskey) return null;
  try {
    const endpoint = new URL(parts.endpoint);
    if (endpoint.protocol !== 'https:') return null;
    return {
      endpoint: endpoint.origin,
      host: endpoint.host,
      accessKey: parts.accesskey,
      senderAddress,
      publicBaseUrl
    };
  } catch {
    return null;
  }
}

function plainText(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function serviceError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function emailConfigured() {
  return Boolean(configuration());
}

export async function sendEmail(to, subject, html, requestId) {
  const config = configuration();
  if (!config) throw serviceError(503, 'El servicio de correo aún no está configurado.');

  const body = JSON.stringify({
    senderAddress: config.senderAddress,
    recipients: { to: [{ address: to }] },
    content: { subject, plainText: plainText(html), html }
  });
  const date = new Date().toUTCString();
  const contentHash = createHash('sha256').update(body).digest('base64');
  const stringToSign = `POST\n${EMAIL_PATH}\n${date};${config.host};${contentHash}`;
  const signature = createHmac('sha256', Buffer.from(config.accessKey, 'base64')).update(stringToSign, 'utf8').digest('base64');
  const clientRequestId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId || '') ? requestId : randomUUID();

  const response = await fetch(`${config.endpoint}${EMAIL_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ms-date': date,
      'x-ms-content-sha256': contentHash,
      'x-ms-client-request-id': clientRequestId,
      Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`
    },
    body,
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    console.error('Azure email send failed', { status: response.status, code: details?.error?.code || details?.code });
    throw serviceError(502, 'El proveedor de correo no pudo aceptar el mensaje.');
  }

  return { requestId: clientRequestId, operationLocation: response.headers.get('operation-location') };
}
