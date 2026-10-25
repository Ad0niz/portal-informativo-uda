const state = { user: null, announcements: [], categories: [], filter: 'all', editingId: null, rejectId: null, cloud: false };
const $ = selector => document.querySelector(selector);
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const statusLabels = { draft: 'Borrador', pending: 'En revisión', rejected: 'Devuelto', published: 'Publicado', archived: 'Archivado' };
const roleLabels = { owner: 'Administración', editor: 'Redactor', approver: 'Aprobador' };
let toastTimer;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Error ${response.status}`);
  return result;
}

function message(selector, text, error = false) {
  const element = $(selector);
  element.textContent = text;
  element.classList.toggle('error', error);
}

function toast(text) {
  const box = $('#toast');
  box.textContent = text; box.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('show'), 4000);
}

function updateAuth(user) {
  state.user = user;
  $('#login-view').hidden = Boolean(user);
  $('#dashboard').hidden = !user;
  $('#logout').hidden = !user;
  if (!user) return;
  $('#admin-user').innerHTML = `<strong>${html(user.name)}</strong>${html(roleLabels[user.role] || user.role)}`;
  $('#user-section').hidden = user.role !== 'owner';
}

function resetEditor() {
  state.editingId = null;
  $('#editor-form').reset();
  $('#editor-title').textContent = 'Nuevo aviso';
  message('#editor-message', '');
  $('#editor-form button[type="submit"]').textContent = 'Guardar borrador';
}

function editItem(item) {
  state.editingId = item.id;
  const form = $('#editor-form');
  for (const name of ['title', 'summary', 'body', 'category', 'eventDate', 'priority']) form.elements[name].value = item[name] || '';
  $('#editor-title').textContent = 'Editar aviso';
  $('#editor-form button[type="submit"]').textContent = 'Guardar cambios';
  message('#editor-message', item.status === 'published' ? 'Los cambios al aviso publicado se guardan sin enviar nuevas notificaciones.' : '');
  document.querySelector('.editor-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTabs() {
  const tabs = [['all', 'Todos'], ['pending', 'En revisión'], ['draft', 'Borradores'], ['rejected', 'Devueltos'], ['published', 'Publicados'], ['archived', 'Archivados']];
  $('#admin-tabs').innerHTML = tabs.map(([value, label]) => `<button type="button" class="admin-tab ${state.filter === value ? 'active' : ''}" data-filter="${value}" aria-pressed="${state.filter === value}">${label}</button>`).join('');
  $('#admin-tabs').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; renderList(); }));
}

function actionsFor(item) {
  const reviewer = ['owner', 'approver'].includes(state.user.role);
  const author = item.authorId === state.user.id;
  const buttons = [];
  if (state.cloud ? author && ['draft','rejected'].includes(item.status) : (reviewer || author) && (reviewer || ['draft', 'rejected'].includes(item.status))) buttons.push(['edit', 'Editar', '']);
  if (['draft', 'rejected'].includes(item.status) && author) buttons.push(['submit', 'Enviar a revisión', 'primary']);
  if (item.status === 'pending' && reviewer && !author) { buttons.push(['approve', 'Aprobar y publicar', 'primary']); buttons.push(['reject', 'Devolver', '']); }
  if (item.status === 'published' && reviewer) buttons.push(['archive', 'Archivar', '']);
  if (state.cloud && item.status === 'published' && reviewer) buttons.push(['deliver', 'Enviar pendientes', '']);
  if (['draft', 'rejected'].includes(item.status) && (state.cloud ? author : reviewer || author)) buttons.push(['delete', 'Eliminar', 'danger']);
  return buttons.map(([action, label, style]) => `<button class="small-button ${style}" type="button" data-action="${action}" data-id="${html(item.id)}">${label}</button>`).join('');
}

function renderList() {
  renderTabs();
  const items = state.filter === 'all' ? state.announcements : state.announcements.filter(item => item.status === state.filter);
  $('#admin-count').textContent = `${items.length} ${items.length === 1 ? 'aviso' : 'avisos'}`;
  $('#admin-list').innerHTML = items.length ? items.map(item => `<article class="admin-row"><div class="admin-row-main"><div class="admin-row-meta"><span class="status-pill ${html(item.status)}">${html(statusLabels[item.status] || item.status)}</span><span class="category-pill">${html(item.category)}</span>${item.demo ? '<span class="demo-pill">Demostración</span>' : ''}</div><h3>${html(item.title)}</h3><p>${html(item.authorName || 'Ejemplo inicial')} · ${html(item.summary)}</p>${item.rejectionNote ? `<p class="form-message error">Motivo de devolución: ${html(item.rejectionNote)}</p>` : ''}</div><div class="admin-row-actions">${actionsFor(item)}</div></article>`).join('') : '<div class="admin-empty">No hay avisos en esta sección.</div>';
  $('#admin-list').querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id)));
}

async function loadAnnouncements() {
  state.announcements = await api('/api/admin/announcements');
  renderList();
}

async function loadUsers() {
  if (state.user.role !== 'owner') return;
  const users = await api('/api/admin/users');
  $('#users-list').innerHTML = users.map(user => `<div class="user-row"><div><strong>${html(user.name)}</strong><small>${html(user.username)}</small></div><span>${html(roleLabels[user.role])}</span></div>`).join('');
}

async function handleAction(action, id) {
  const item = state.announcements.find(entry => entry.id === id);
  if (!item) return;
  if (action === 'edit') return editItem(item);
  if (action === 'reject') { state.rejectId = id; $('#reject-form').reset(); message('#reject-message', ''); $('#reject-dialog').showModal(); return; }
  if (action === 'delete' && !confirm(`¿Eliminar "${item.title}"?`)) return;
  if (action === 'archive' && !confirm(`¿Archivar "${item.title}"? Dejará de aparecer en el portal.`)) return;
  if (action === 'approve' && !confirm(`¿Publicar "${item.title}" y enviar las notificaciones a suscriptores?`)) return;
  try {
    const result = await api(`/api/admin/announcements/${encodeURIComponent(id)}${action === 'delete' ? '' : `/${action}`}`, { method: action === 'delete' ? 'DELETE' : 'POST' });
    await loadAnnouncements();
    if (action === 'approve' || action === 'deliver') toast(`${action === 'approve' ? 'Aviso publicado. ' : ''}Correos: ${result.delivery.emailSent}; navegador: ${result.delivery.pushSent}.${result.delivery.error ? ' Reintenta el envío de notificaciones.' : result.delivery.pending ? ` Pendientes: ${result.delivery.pending}. Usa Enviar pendientes para continuar.` : ''}`);
    else toast(action === 'submit' ? 'Aviso enviado a revisión.' : action === 'archive' ? 'Aviso archivado.' : 'Aviso eliminado.');
  } catch (error) { toast(error.message); }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; message('#login-message', 'Ingresando…');
  try {
    const result = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: form.elements.username.value, password: form.elements.password.value }) });
    updateAuth(result.user); form.reset();
    await Promise.all([loadAnnouncements(), loadUsers()]);
  } catch (error) { message('#login-message', error.message, true); }
  finally { button.disabled = false; }
});

$('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); updateAuth(null); resetEditor(); });
$('#reset-editor').addEventListener('click', resetEditor);

$('#editor-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form));
  button.disabled = true; message('#editor-message', 'Guardando…');
  try {
    const id = state.editingId;
    await api(id ? `/api/admin/announcements/${encodeURIComponent(id)}` : '/api/admin/announcements', { method: id ? 'PUT' : 'POST', body: JSON.stringify(values) });
    resetEditor(); await loadAnnouncements(); toast('Borrador guardado.');
  } catch (error) { message('#editor-message', error.message, true); }
  finally { button.disabled = false; }
});

$('#reject-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; message('#reject-message', 'Guardando…');
  try {
    await api(`/api/admin/announcements/${encodeURIComponent(state.rejectId)}/reject`, { method: 'POST', body: JSON.stringify({ note: form.elements.note.value }) });
    $('#reject-dialog').close(); await loadAnnouncements(); toast('Aviso devuelto a la persona redactora.');
  } catch (error) { message('#reject-message', error.message, true); }
  finally { button.disabled = false; }
});

$('#user-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; message('#user-message', 'Creando cuenta…');
  try {
    await api('/api/admin/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset(); await loadUsers(); message('#user-message', 'Cuenta creada.');
  } catch (error) { message('#user-message', error.message, true); }
  finally { button.disabled = false; }
});

document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));

async function initialize() {
  try {
    const [config, session] = await Promise.all([api('/api/config'), api('/api/session')]);
    state.categories = config.categories;
    state.cloud = config.authMode === 'supabase';
    if (state.cloud) {
      for (const id of ['username','new-username']) {
        const field = document.getElementById(id);
        field.type = 'email'; field.maxLength = 254; field.removeAttribute('pattern'); field.placeholder = 'nombre@ejemplo.cl';
        document.querySelector(`label[for="${id}"]`).textContent = 'Correo electrónico';
      }
    }
    $('#notice-category').innerHTML = config.categories.map(category => `<option value="${html(category)}">${html(category)}</option>`).join('');
    if (!session.enabled) message('#login-message', 'El acceso al panel todavía no está configurado.', true);
    if (session.authenticated) { updateAuth(session.user); await Promise.all([loadAnnouncements(), loadUsers()]); }
  } catch (error) { message('#login-message', error.message, true); }
}
initialize();
