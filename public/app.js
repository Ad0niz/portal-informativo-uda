const state = { announcements: [], categories: [], category: 'Todos', query: '', config: null };
const $ = selector => document.querySelector(selector);
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatDate = value => new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' }).format(new Date(value));
const dateParts = value => {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Santiago' }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
};
let toastTimer;

async function withDeadline(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

function toast(message) {
  const box = $('#toast');
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), 4000);
}

function renderFilters() {
  $('#filters').innerHTML = ['Todos', ...state.categories].map(category => `<button type="button" class="filter-button ${state.category === category ? 'active' : ''}" data-category="${html(category)}" aria-pressed="${state.category === category}">${html(category)}</button>`).join('');
  $('#filters').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { state.category = button.dataset.category; render(); }));
}

function filteredItems() {
  const query = state.query.toLocaleLowerCase('es-CL');
  return state.announcements.filter(item => (state.category === 'Todos' || item.category === state.category) && (!query || `${item.title} ${item.summary} ${item.body} ${item.category}`.toLocaleLowerCase('es-CL').includes(query)));
}

function noticeCard(item) {
  const date = dateParts(item.publishedAt);
  return `<article class="notice-card" tabindex="0" role="button" aria-label="Leer ${html(item.title)}" data-id="${html(item.id)}"><div class="notice-date"><span class="notice-day">${html(date.day)}</span><span class="notice-month">${html(date.month.toUpperCase())}</span><span class="notice-year">${html(date.year)}</span></div><div class="notice-content"><div class="notice-meta"><span class="category-pill">${html(item.category)}</span>${item.priority === 'urgent' ? '<span class="priority-pill">Importante</span>' : ''}${item.demo ? '<span class="demo-pill">Demostración</span>' : ''}</div><h3>${html(item.title)}</h3><p>${html(item.summary)}</p></div><span class="notice-arrow" aria-hidden="true">↗</span></article>`;
}

function renderFeatured() {
  const featured = state.announcements.find(item => item.priority === 'urgent') || state.announcements[0];
  if (!featured) {
    $('#featured-content').innerHTML = '<div class="feature-body"><span class="feature-category">Sin publicaciones</span><h2>Pronto habrá avisos aquí.</h2><p>Consulta esta página para revisar novedades de la carrera.</p></div>';
    return;
  }
  $('#featured-content').innerHTML = `<div class="feature-body"><span class="feature-category">${html(featured.category)}${featured.demo ? ' · EJEMPLO' : ''}</span><h2>${html(featured.title)}</h2><p>${html(featured.summary)}</p></div>`;
  $('#featured-content').style.cursor = 'pointer';
  $('#featured-content').onclick = () => showNotice(featured.id);
}

function render() {
  renderFilters();
  renderFeatured();
  const items = filteredItems();
  $('#result-count').textContent = `${items.length} ${items.length === 1 ? 'aviso' : 'avisos'}`;
  $('#notice-list').innerHTML = items.map(noticeCard).join('');
  $('#empty-state').hidden = items.length > 0;
  $('#notice-list').querySelectorAll('.notice-card').forEach(card => {
    card.addEventListener('click', () => showNotice(card.dataset.id));
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showNotice(card.dataset.id); } });
  });
}

function showNotice(id) {
  const item = state.announcements.find(entry => entry.id === id);
  if (!item) return toast('Este aviso ya no está disponible.');
  $('#notice-detail').innerHTML = `<div class="dialog-body"><div class="dialog-meta"><span class="category-pill">${html(item.category)}</span>${item.priority === 'urgent' ? '<span class="priority-pill">Importante</span>' : ''}${item.demo ? '<span class="demo-pill">Demostración</span>' : ''}</div><h2>${html(item.title)}</h2><p class="dialog-summary">${html(item.summary)}</p><div class="dialog-date"><span>Publicado el ${html(formatDate(item.publishedAt))}</span>${item.eventDate ? `<span>Fecha del evento: ${html(new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.eventDate}T12:00:00Z`)))}</span>` : ''}</div><div class="dialog-text">${html(item.body)}</div><div class="dialog-actions"><button type="button" id="share-notice">Compartir aviso ↗</button></div></div>`;
  $('#notice-dialog').showModal();
  const url = new URL(location.href); url.searchParams.set('aviso', id); history.replaceState({}, '', url);
  $('#share-notice').addEventListener('click', async () => {
    const shareUrl = location.href;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: shareUrl });
      else { await navigator.clipboard.writeText(shareUrl); toast('Enlace copiado.'); }
    } catch (error) { if (error.name !== 'AbortError') toast('No se pudo compartir el enlace.'); }
  });
}

function closeDialog(dialog) {
  dialog.close();
  if (dialog.id === 'notice-dialog') { const url = new URL(location.href); url.searchParams.delete('aviso'); history.replaceState({}, '', url); }
}

function categoryChecks() {
  return `<div class="check-grid">${state.categories.map((category, index) => `<label class="check-item"><input type="checkbox" name="categories" value="${html(category)}" ${index < 3 ? 'checked' : ''}><span>${html(category)}</span></label>`).join('')}</div>`;
}

function checkedCategories(form) {
  return [...form.querySelectorAll('[name="categories"]:checked')].map(input => input.value);
}

function showEmailForm() {
  $('#subscribe-content').innerHTML = `<div class="dialog-body"><span class="section-kicker">AVISOS POR CORREO</span><h2>Recibe solo lo que te interesa.</h2><p class="dialog-summary">Te enviaremos un correo para confirmar tu suscripción. Puedes darte de baja desde cualquier aviso.</p><form id="email-form"><div class="field"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="email" required placeholder="tu.correo@ejemplo.cl"></div><div class="field"><span>Temas de interés</span>${categoryChecks()}</div><button class="button button-dark" type="submit">Enviar confirmación ↗</button><p class="form-message" id="form-message" role="status"></p></form></div>`;
  $('#subscribe-dialog').showModal();
  if (state.config.emailTestMode) $('#subscribe-content .dialog-summary').textContent = 'Demo: el envío está habilitado solo para el correo de prueba autorizado. Recibirás un enlace para confirmar tu suscripción.';
  $('#email-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const message = $('#form-message'); message.textContent = 'Enviando…'; message.classList.remove('error');
    try {
      const response = await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.elements.email.value, categories: checkedCategories(form) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo completar la suscripción.');
      message.textContent = result.message; form.reset();
    } catch (error) { message.textContent = error.message; message.classList.add('error'); }
    finally { button.disabled = false; }
  });
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function showPushForm() {
  $('#subscribe-content').innerHTML = `<div class="dialog-body"><span class="section-kicker">AVISOS DEL NAVEGADOR</span><h2>Un aviso cuando importe.</h2><p class="dialog-summary">Recibe notificaciones clicables en este dispositivo, incluso si el portal no está abierto. Tu navegador pedirá permiso.</p><form id="push-form"><div class="field"><span>Temas de interés</span>${categoryChecks()}</div><button class="button button-dark" type="submit">Permitir notificaciones ↗</button><button class="small-button danger" id="push-disable" type="button" hidden>Desactivar en este navegador</button><p class="form-message" id="form-message" role="status"></p></form></div>`;
  $('#subscribe-dialog').showModal();
  navigator.serviceWorker.getRegistration('/sw.js').then(async registration => {
    if (await registration?.pushManager.getSubscription()) $('#push-disable').hidden = false;
  }).catch(() => {});
  $('#push-disable').addEventListener('click', async () => {
    const message = $('#form-message');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
          const response = await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
          if (!response.ok) throw new Error('No se pudo eliminar la suscripción del servidor.');
        await subscription.unsubscribe();
      }
      $('#push-disable').hidden = true;
      message.textContent = 'Notificaciones desactivadas en este navegador.';
      message.classList.remove('error');
    } catch { message.textContent = 'No se pudieron desactivar las notificaciones. Intenta otra vez.'; message.classList.add('error'); }
  });
  $('#push-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const categories = checkedCategories(form);
    const message = $('#form-message'); message.classList.remove('error');
    if (!categories.length) { message.textContent = 'Elige al menos un tema.'; message.classList.add('error'); return; }
    button.disabled = true; message.textContent = 'Configurando notificaciones…';
    try {
      const permission = await withDeadline(Notification.requestPermission(), 20000, 'No se recibió respuesta al permiso. Abre el portal en Chrome, Edge o Firefox y permite las notificaciones desde allí.');
      if (permission !== 'granted') throw new Error('Debes permitir las notificaciones en el navegador.');
      await navigator.serviceWorker.register('/sw.js');
      const registration = await withDeadline(navigator.serviceWorker.ready, 15000, 'No se pudo activar el servicio de notificaciones. Recarga el portal e intenta nuevamente.');
      const subscription = await registration.pushManager.getSubscription() || await withDeadline(registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(state.config.vapidPublicKey) }), 20000, 'El servicio de notificaciones no respondió. Prueba en Chrome, Edge o Firefox.');
      const response = await fetch('/api/push/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription, categories }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar la suscripción.');
      message.textContent = 'Listo. Recibirás avisos de los temas seleccionados en este dispositivo.';
      button.textContent = 'Actualizar preferencias';
      $('#push-disable').hidden = false;
    } catch (error) { message.textContent = error.message; message.classList.add('error'); }
    finally { button.disabled = false; }
  });
}

async function initialize() {
  try {
    const [configResponse, announcementsResponse] = await Promise.all([fetch('/api/config'), fetch('/api/announcements')]);
    if (!configResponse.ok || !announcementsResponse.ok) throw new Error('No se pudo cargar el portal.');
    state.config = await configResponse.json();
    state.categories = state.config.categories;
    state.announcements = await announcementsResponse.json();
    render();
    const pushAvailable = state.config.pushNotifications && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
    $('#push-open').hidden = !pushAvailable;
    $('#email-open').hidden = !state.config.emailNotifications;
    $('#subscribe-unavailable').hidden = pushAvailable || state.config.emailNotifications;
    const target = new URLSearchParams(location.search).get('aviso');
    if (target) showNotice(target);
    const subscription = new URLSearchParams(location.search).get('suscripcion');
    if (subscription === 'confirmada') toast('Tu correo quedó suscrito a los avisos.');
    if (subscription === 'baja') toast('Dejaste de recibir avisos por correo.');
    if (subscription === 'invalida') toast('El enlace de confirmación no es válido.');
  } catch (error) {
    $('#notice-list').innerHTML = `<div class="empty-state"><h3>No pudimos cargar los avisos</h3><p>Intenta actualizar la página.</p></div>`;
    $('#result-count').textContent = 'Sin conexión';
  }
}

$('#search').addEventListener('input', event => { state.query = event.target.value.trim(); render(); });
$('#clear-filters').addEventListener('click', () => { state.category = 'Todos'; state.query = ''; $('#search').value = ''; render(); });
$('#email-open').addEventListener('click', showEmailForm);
$('#push-open').addEventListener('click', showPushForm);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(dialog); }));
$('#notice-dialog').addEventListener('close', () => { if (new URLSearchParams(location.search).has('aviso')) { const url = new URL(location.href); url.searchParams.delete('aviso'); history.replaceState({}, '', url); } });
initialize();
setInterval(async () => { try { const response = await fetch('/api/announcements'); if (response.ok) { state.announcements = await response.json(); render(); } } catch {} }, 60_000);
