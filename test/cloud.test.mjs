import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudHandler, validPushEndpoint } from '../lib/cloud.mjs';

test('cloud API fails closed, rejects cross-origin writes and requires an authenticated editor', async () => {
  const saved = { url:process.env.SUPABASE_URL, pub:process.env.SUPABASE_PUBLISHABLE_KEY, secret:process.env.SUPABASE_SECRET_KEY };
  try {
    delete process.env.SUPABASE_SECRET_KEY;
    const unavailable = await cloudHandler(new Request('https://portal.example/api/announcements'));
    assert.equal(unavailable.status,503);
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
    process.env.SUPABASE_SECRET_KEY='test-server';
    const anonymous = await cloudHandler(new Request('https://portal.example/api/admin/announcements',{method:'POST',body:'{}'}));
    assert.equal(anonymous.status,401);
    const crossOrigin = await cloudHandler(new Request('https://portal.example/api/login',{method:'POST',headers:{origin:'https://attacker.example'},body:'{}'}));
    assert.equal(crossOrigin.status,403);
    const config = await (await cloudHandler(new Request('https://portal.example/api/config'))).json();
    assert.equal(config.authMode,'supabase');
    assert.equal(JSON.stringify(config).includes('test-server'),false);
  } finally {
    for (const [key,value] of Object.entries({SUPABASE_URL:saved.url,SUPABASE_PUBLISHABLE_KEY:saved.pub,SUPABASE_SECRET_KEY:saved.secret})) {
      if (value===undefined) delete process.env[key]; else process.env[key]=value;
    }
  }
});

test('push endpoints cannot send server requests to arbitrary hosts', () => {
  for (const endpoint of ['http://fcm.googleapis.com/x','https://localhost/x','https://127.0.0.1/x','https://fcm.googleapis.com.attacker.example/x','https://fcm.googleapis.com:8443/x','https://user:pass@fcm.googleapis.com/x']) assert.equal(validPushEndpoint(endpoint),false,endpoint);
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/example','https://jmt17.google.com/fcm/send/example','https://updates.push.services.mozilla.com/wpush/v2/example','https://web.push.apple.com/example']) assert.equal(validPushEndpoint(endpoint),true,endpoint);
});
