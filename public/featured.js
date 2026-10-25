const card = document.querySelector('#hero-feature');
const label = document.querySelector('#feature-label');
const date = document.querySelector('#feature-date');
const category = document.querySelector('#feature-category');
const title = document.querySelector('#feature-title');
const summary = document.querySelector('#feature-summary');
const cta = document.querySelector('#feature-cta');

const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const timeZone = 'America/Santiago';
const dayKey = value => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(new Date(value));

function featuredDate(value) {
  if (!value) return '';
  const published = new Date(value);
  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86400000));
  const target = dayKey(published);
  const hour = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(published);
  if (target === today) return `HOY · ${hour}`;
  if (target === yesterday) return `AYER · ${hour}`;
  const shortDate = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', timeZone }).format(published).replace('.', '').toUpperCase();
  return `${shortDate} · ${hour}`;
}

function showAllNotices() {
  document.querySelector('#avisos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openFeatured() {
  const id = card?.dataset.noticeId;
  if (!id) return showAllNotices();
  const url = new URL(location.href);
  url.searchParams.set('aviso', id);
  location.href = url.toString();
}

function renderEmpty() {
  card.classList.add('feature-empty');
  card.classList.remove('feature-urgent');
  delete card.dataset.noticeId;
  card.setAttribute('aria-label', 'Ver todos los avisos');
  label.textContent = 'PANEL INFORMATIVO';
  date.textContent = '';
  category.textContent = 'SIN NOVEDADES';
  title.textContent = 'Todo al día por ahora.';
  summary.textContent = 'Aquí destacaremos los avisos académicos más recientes cuando haya una nueva publicación.';
  cta.innerHTML = 'Ver todos los avisos <b aria-hidden="true">→</b>';
}

function renderFeatured(item) {
  const urgent = item.priority === 'urgent';
  card.classList.remove('feature-empty');
  card.classList.toggle('feature-urgent', urgent);
  card.dataset.noticeId = item.id;
  card.setAttribute('aria-label', `Leer aviso: ${item.title}`);
  label.textContent = urgent ? 'AVISO IMPORTANTE' : 'ÚLTIMO AVISO';
  date.textContent = featuredDate(item.publishedAt);
  category.textContent = item.category;
  title.textContent = item.title;
  summary.textContent = item.summary;
  cta.innerHTML = 'Ver aviso completo <b aria-hidden="true">→</b>';
}

async function updateFeatured() {
  try {
    const response = await fetch('/api/announcements', { cache: 'no-store' });
    if (!response.ok) throw new Error('No disponible');
    const announcements = await response.json();
    const real = announcements.filter(item => !item.demo);
    const featured = real.find(item => item.priority === 'urgent') || real[0];
    if (featured) renderFeatured(featured);
    else renderEmpty();
  } catch {
    renderEmpty();
  }
}

card?.addEventListener('click', openFeatured);
card?.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openFeatured();
  }
});

updateFeatured();
setInterval(updateFeatured, 60000);
