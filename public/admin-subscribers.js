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

function renderCategories(categories) {
  const values = Array.isArray(categories) ? categories.filter(Boolean) : [];
  if (!values.length) return '<span class="subscriber-chip muted">Sin categorías</span>';
  return values.map(value => `<span class="subscriber-chip">${html(value)}</span>`).join('');
}

function render(items) {
  count.textContent = `${items.length} ${items.length === 1 ? 'suscriptor' : 'suscriptores'}`;
  if (!items.length) {
    list.innerHTML = '<div class="subscriber-empty">Todavía no hay correos registrados en el boletín.</div>';
    return;
  }
  list.innerHTML = items.map(item => {
    const email = String(item.email || '').trim();
    const initial = email ? email.charAt(0).toUpperCase() : '@';
    return `
      <article class="subscriber-row">
        <div class="subscriber-main">
          <div class="subscriber-identity">
            <span class="subscriber-icon" aria-hidden="true">${html(initial)}</span>
            <div class="subscriber-copy">
              <span class="subscriber-label">Correo suscrito</span>
              <strong>${html(email)}</strong>
            </div>
          </div>
          <div class="subscriber-categories">
            ${renderCategories(item.categories)}
          </div>
        </div>
        <div class="subscriber-meta">
          <div class="subscriber-meta-top">
            <span class="subscriber-status ${item.confirmed ? 'confirmed' : 'pending'}">${item.confirmed ? 'Confirmado' : 'Pendiente'}</span>
            <button class="subscriber-remove" type="button" data-remove-subscriber="${html(email)}">Eliminar</button>
          </div>
          <div class="subscriber-date-block">
            <span class="subscriber-date-label">Última actualización</span>
            <small>${html(formatDate(item.updatedAt))}</small>
          </div>
        </div>
      </article>
    `;
  }).join('');
  list.querySelectorAll('[data-remove-subscriber]').forEach(button => {
    button.addEventListener('click', () => removeSubscriber(button.dataset.removeSubscriber, button));
  });
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

async function removeSubscriber(email, button) {
  if (!email || !confirm(`¿Eliminar a ${email} del boletín informativo?\n\nDejará de recibir futuros avisos por correo.`)) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Eliminando…';
  try {
    const response = await fetch(`/api/admin/subscribers?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Error ${response.status}`);
    await loadSubscribers();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = original;
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
