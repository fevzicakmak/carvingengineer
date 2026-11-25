import { loadCatalog, loadDraft, types } from './catalog.js';

const get = id => document.getElementById(id);
const grid = get('gallery-grid');
const dialog = get('viewer');
const filters = [...document.querySelectorAll('[data-filter]')];
const draftMode = new URLSearchParams(location.search).get('taslak') === '1';
let catalog = [];
let filtered = [];
let filter = 'all';
let current = 0;
let draftFiles = {};
const objectUrls = new Map();

function asset(path) {
  if (!path || !/^assets\/[\w./-]+$/.test(path) || path.includes('..')) return '';
  const file = draftFiles[path];
  if (!file) return path;
  if (!objectUrls.has(path)) objectUrls.set(path, URL.createObjectURL(file));
  return objectUrls.get(path);
}

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function hero() {
  const item = catalog.find(entry => entry.type === 'image' && asset(entry.src))
    || catalog.find(entry => asset(entry.poster));
  if (!item) return;
  const photo = get('hero-photo');
  photo.src = asset(item.type === 'image' ? item.src : item.poster);
  photo.alt = item.title;
  get('hero-credit').textContent = [item.title, item.label].filter(Boolean).join(' · ');
  get('hero-media').hidden = false;
}

function render() {
  filtered = catalog.filter(item => filter === 'all' || item.type === filter);
  filters.forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.filter === filter);
    button.hidden = button.dataset.filter !== 'all' &&
      !catalog.some(item => item.type === button.dataset.filter);
  });
  get('gallery-status').textContent = filtered.length ? '' : 'Galeride henüz içerik yok.';
  grid.replaceChildren(...filtered.map((item, index) => {
    const button = element('button', '', 'tile');
    button.type = 'button';
    const media = element('span', '', 'tile-media');
    const thumbnail = asset(item.type === 'image' ? item.src : item.poster);
    if (thumbnail) {
      const image = element('img');
      image.src = thumbnail;
      image.alt = '';
      image.loading = 'lazy';
      media.append(image);
    } else {
      media.textContent = types[item.type] || '';
    }
    button.append(media, element('h3', item.title), element('p', item.label || types[item.type]));
    button.addEventListener('click', () => show(index));
    return button;
  }));
}

function show(index) {
  current = (index + filtered.length) % filtered.length;
  const item = filtered[current];
  const display = get('viewer-media');
  get('viewer-title').textContent = item.title;
  get('viewer-description').textContent = item.description || '';
  get('previous').disabled = filtered.length < 2;
  get('next').disabled = filtered.length < 2;
  const src = asset(item.src);
  display.replaceChildren();
  if (src && item.type === 'video') {
    const video = element('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (asset(item.poster)) video.poster = asset(item.poster);
    video.src = src;
    display.append(video);
  } else if (src && item.type === 'image') {
    const image = element('img');
    image.src = src;
    image.alt = item.title;
    display.append(image);
  } else if (src && item.type === 'model') {
    const frame = element('iframe');
    frame.title = item.title;
    frame.src = src;
    display.append(frame);
  }
  if (!dialog.open) dialog.showModal();
}

filters.forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  render();
}));
get('close-viewer').addEventListener('click', () => dialog.close());
get('previous').addEventListener('click', () => show(current - 1));
get('next').addEventListener('click', () => show(current + 1));
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => get('viewer-media').replaceChildren());
dialog.addEventListener('keydown', event => {
  if (event.target.closest('video') || filtered.length < 2) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    show(current + (event.key === 'ArrowRight' ? 1 : -1));
  }
});

try {
  const draft = draftMode ? await loadDraft() : null;
  catalog = draft?.items ?? await loadCatalog();
  draftFiles = draft?.files ?? {};
  if (draftMode) document.querySelector('.eyebrow').textContent = 'Taslak önizleme';
  hero();
  render();
} catch (error) {
  get('gallery-status').textContent = error.message;
}
