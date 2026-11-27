import { loadCatalog, loadSite, types } from './catalog.js';

import { pageUrl, validatedUrl } from './site-content.js';

const get = id => document.getElementById(id);
const grid = get('gallery-grid');
const dialog = get('viewer');
const filters = [...document.querySelectorAll('[data-filter]')];
const query = new URLSearchParams(location.search);
const draftMode = query.get('taslak') === '1';
let catalog = [];
let filtered = [];
let filter = 'all';
let current = 0;
let draftFiles = {};
const objectUrls = new Map();

const menuToggle = get('site-menu-toggle');
if (menuToggle) {
  const menu = get('site-nav');
  function closeMenu() {
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  menuToggle.hidden = false;
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  menuToggle.parentElement.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || menuToggle.getAttribute('aria-expanded') !== 'true') return;
    closeMenu();
    menuToggle.focus();
  });
}

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
    const meta = item.label || types[item.type];
    const count = item.views?.length;
    button.append(media, element('h3', item.title),
      element('p', count ? meta + ' · ' + (count + 1) + ' görsel' : meta));
    button.addEventListener('click', () => show(index));
    return button;
  }));
}

function showImage(item, display) {
  const image = element('img');
  const views = [{ src:item.src, caption:item.coverCaption }, ...(item.views ?? [])]
    .filter(view => asset(view.src));
  const primary = views[0];
  if (!primary) return;
  image.alt = item.title;
  image.src = asset(primary.src);
  display.append(image);
  if (views.length < 2) return;

  const toolbar = element('div', '', 'viewer-views');
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Çalışmanın görselleri');
  const caption = element('p', '', 'viewer-view-caption');
  caption.setAttribute('aria-live', 'polite');
  const buttons = views.map((view, index) => {
    const button = element('button', view.caption || (index + 1) + '. görsel');
    button.type = 'button';
    button.addEventListener('click', () => select(index));
    return button;
  });
  function select(index) {
    const view = views[index];
    image.src = asset(view.src);
    image.alt = [item.title, view.caption].filter(Boolean).join(' · ');
    caption.textContent = (index + 1) + ' / ' + views.length;
    buttons.forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
  }
  toolbar.append(...buttons);
  display.append(toolbar, caption);
  select(0);
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
    showImage(item, display);
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

function displayPages(site, previewing) {
  const nav = get('site-nav');
  for (const link of nav.querySelectorAll('a')) {
    link.href = pageUrl('', previewing) + link.hash;
  }
  document.querySelector('.brand').href = pageUrl('', previewing);
  const slug = query.get('sayfa');
  for (const page of site.pages.filter(item => item.menu)) {
    const link = element('a', page.title);
    link.href = pageUrl(page.slug, previewing);
    if (page.slug === slug) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  if (!slug) return;
  const page = site.pages.find(item => item.slug === slug);
  get('home').hidden = true;
  get('custom-page').hidden = false;
  get('custom-title').textContent = page?.title ?? 'Sayfa bulunamadı';
  document.title = (page?.title ?? 'Sayfa bulunamadı') + ' · Fevzi Çakmak';
  const content = get('custom-blocks');
  if (!page) {
    const home = element('a', 'Ana sayfaya dön', 'primary');
    home.href = pageUrl('', previewing);
    content.append(home);
    return;
  }
  for (const block of page.blocks) {
    if (block.type === 'text' || block.type === 'heading') {
      const heading = block.type === 'heading';
      const node = element(heading ? 'h2' : 'p', block.text, 'page-block');
      for (const [value, choices] of [
        [block.align, ['left', 'center', 'right']], [block.size, ['small', 'normal', 'large']],
        [block.tone, ['ink', 'muted', 'accent']], [block.face, ['serif', 'sans']]
      ]) {
        if (choices.includes(value)) node.classList.add('is-' + value);
      }
      if (block.bold) node.classList.add('is-bold');
      if (block.italic) node.classList.add('is-italic');
      content.append(node);
    } else if (block.type === 'image' || block.type === 'video') {
      const media = catalog.find(item => item.id === block.mediaId && item.type === block.type);
      const src = asset(media?.src);
      if (!src) continue;
      const figure = element('figure', '', 'page-block');
      if (block.fit === 'compact') figure.classList.add('is-compact');
      if (block.type === 'image' && media.views?.length) {
        showImage(media, figure);
      } else if (block.type === 'image') {
        const image = element('img');
        image.alt = media.title;
        image.loading = 'lazy';
        image.src = src;
        figure.append(image);
      } else {
        const video = element('video');
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        if (asset(media.poster)) video.poster = asset(media.poster);
        video.src = src;
        figure.append(video);
      }
      if (media.label) figure.append(element('figcaption', media.label));
      content.append(figure);
    } else if (block.type === 'link') {
      const destination = site.pages.find(item => item.id === block.target);
      const href = block.target === 'external' ? validatedUrl(block.href) :
        (destination || block.target === 'home' ? pageUrl(destination?.slug, previewing) : '');
      if (!href) continue;
      const link = element('a', block.caption, 'primary page-block');
      link.href = href;
      content.append(link);
    } else if (block.type === 'divider') {
      content.append(element('hr', '', 'page-block'));
    }
  }
}

function requestPreview() {
  if (!draftMode || !window.opener) return Promise.resolve(null);
  const manager = window.opener;
  return new Promise(resolve => {
    function receive(event) {
      if (event.origin !== location.origin || event.source !== manager ||
          event.data?.type !== 'gallery-preview' || !Array.isArray(event.data.items)) return;
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      resolve(event.data);
    }
    const timeout = setTimeout(() => {
      window.removeEventListener('message', receive);
      resolve(null);
    }, 2000);
    window.addEventListener('message', receive);
    manager.postMessage('gallery-preview-ready', location.origin);
  });
}

try {
  const draft = await requestPreview();
  catalog = draft?.items ?? await loadCatalog();
  draftFiles = draft?.files ?? {};
  if (draft) document.querySelector('.eyebrow').textContent = 'Taslak önizleme';
  displayPages(draft?.site ?? await loadSite(), Boolean(draft));
  hero();
  render();
} catch (error) {
  get('gallery-status').textContent = error.message;
}
