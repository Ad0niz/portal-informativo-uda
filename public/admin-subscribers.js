const section = document.querySelector('#user-section');
const list = document.querySelector('#newsletter-subscribers');
const count = document.querySelector('#subscriber-count');
const refresh = document.querySelector('#refresh-subscribers');

const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Santiago'
  }).format(date);
}

function render(items) {
  count.textContent = `${items.length} ${items.length === 1 ? 'suscriptor' : 'suscriptores'}`;
  if (!items.length) {
    list.innerHTML = '<div class="subscriber-empty">Todavía no hay correos registrados en el boletín.</div>';
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="subscriber-row">
      <div class="subscriber-main">
        <strong>${html(item.email)}</strong>
        <small>${html((item.categories || []).join(' · ') || 'Sin categorías')}</small>
      </div>
      <div class="subscriber-meta">
        <span class="subscriber-status ${item.confirmed ? 'confirmed' : 'pending'}">${item.confirmed ? 'Confirmado' : 'Pendiente'}</span>
        <small>${html(formatDate(item.updatedAt))}</small>
      </div>
    </div>
  `).join('');
}

async function loadSubscribers() {
  if (!section || section.hidden || !list) return;
  refresh.disabled = true;
  count.textContent = 'Cargando…';
  try {
    const response = await fetch('/api/admin/subscribers', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Error ${response.status}`);
    render(result);
  } catch (error) {
    count.textContent = 'No disponible';
    list.innerHTML = `<div class="subscriber-empty error">${html(error.message)}</div>`;
  } finally {
    refresh.disabled = false;
  }
}

refresh?.addEventListener('click', loadSubscribers);

if (section) {
  const observer = new MutationObserver(() => {
    if (!section.hidden) loadSubscribers();
  });
  observer.observe(section, { attributes: true, attributeFilter: ['hidden'] });
  if (!section.hidden) loadSubscribers();
}
