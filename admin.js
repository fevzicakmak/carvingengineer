import { loadCatalog, loadSite, loadDraft, saveDraft, dropDraft, types } from './catalog.js';
import { publishGallery, verifyOwner } from './github.js';

import { createPageEditor } from './page-editor.js';
import { dragHandle } from './drag-order.js';
import { emptySite, moveEntry, pageUrl } from './site-content.js';

const get = id => document.getElementById(id);
const editor = get('editor');
const fields = editor.elements;
const unlockForm = get('unlock');
const publishForm = get('publish');
const status = get('admin-status');
const imageTypes = { jpg:'jpg', jpeg:'jpg', png:'png', webp:'webp', gif:'gif', avif:'avif' };
const videoTypes = { mp4:'mp4', webm:'webm' };
let base = [];
let items = [];
let baseSite = emptySite();
let site = baseSite;
let files = {};
let editingId = null;
let busy = false;
let ownerToken = '';
let previewWindow;

const pageEditor = createPageEditor({
  getSite: () => site,
  getMedia: () => items,
  save: (next, success) => change(items, files, success, next),
  preview: openPreview,
  report: message,
  openMedia: () => switchPanel(true),
  uploadMedia: addPageMedia
});

function switchPanel(media) {
  get('pages-panel').hidden = media;
  get('media-panel').hidden = !media;
  get('show-pages').setAttribute('aria-pressed', String(!media));
  get('show-media').setAttribute('aria-pressed', String(media));
}

get('show-pages').addEventListener('click', () => switchPanel(false));
get('show-media').addEventListener('click', () => switchPanel(true));

function message(text, error = false) {
  status.textContent = text;
  status.dataset.error = String(error);
}

function button(text, action, disabled = false) {
  const result = document.createElement('button');
  result.textContent = text;
  result.type = 'button';
  result.disabled = disabled || busy;
  result.addEventListener('click', action);
  return result;
}

function render() {
  const list = get('items');
  list.replaceChildren(...items.map((item, index) => {
    const row = document.createElement('div');
    row.className = 'admin-item';
    const name = document.createElement('div');
    const title = document.createElement('strong');
    const kind = document.createElement('span');
    title.textContent = item.title;
    kind.textContent = ' · ' + types[item.type];
    name.append(title, kind);
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.append(
      button('Yukarı', () => move(index, -1), index === 0),
      button('Aşağı', () => move(index, 1), index === items.length - 1),
      button('Düzenle', () => openEditor(item)),
      button('Sil', () => remove(item))
    );
    const handle = dragHandle(row, 'media', item.id, (from, to) => {
      if (!ownerToken || busy) return;
      if (to === 'trash') {
        remove(item);
        return;
      }
      const first = items.findIndex(entry => entry.id === from);
      const last = items.findIndex(entry => entry.id === to);
      if (first >= 0 && last >= 0) {
        change(moveEntry(items, first, last), files, 'Galeri sırası kaydedildi.');
      }
    });
    row.append(handle, name, controls);
    return row;
  }));
  if (!items.length) list.textContent = 'Galeride henüz içerik yok.';
  const changed = JSON.stringify(items) !== JSON.stringify(base) ||
    JSON.stringify(site) !== JSON.stringify(baseSite);
  get('add').disabled = busy;
  get('media-files').disabled = busy;
  pageEditor.setBusy(busy);
  get('publish-button').disabled = busy || !changed;
  get('reset-draft').disabled = busy || !changed;
}

function updateFields() {
  const type = fields.type.value;
  fields.media.accept = type === 'video' ? 'video/mp4,video/webm' : fields.poster.accept;
  get('media-field').hidden = type === 'model';
  get('poster-field').hidden = type !== 'video';
  get('file-label').textContent = type === 'video' ? 'Video dosyası' : 'Görsel dosyası';
  get('file-help').textContent = type === 'video' ? 'MP4 veya WebM · En fazla 20 MB' : 'JPG, PNG, WebP, GIF veya AVIF · En fazla 8 MB';
  const original = items.find(item => item.id === editingId);
  fields.media.required = type !== 'model' && (!original || original.type !== type);
}

function openEditor(item) {
  editor.reset();
  editingId = item?.id ?? null;
  fields.title.value = item?.title ?? '';
  fields.description.value = item?.description ?? '';
  fields.label.value = item?.label ?? '';
  fields.type.value = item?.type ?? 'image';
  fields.type.disabled = item?.type === 'model';
  get('editor-title').textContent = item ? 'Medyayı düzenle' : 'Medya ekle';
  editor.hidden = false;
  updateFields();
  fields.title.focus();
}

function stageFile(file, allowed, maxMB, output) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!Object.hasOwn(allowed, extension) || !file.size) throw new Error('Geçerli bir medya dosyası seçin.');
  if (file.size > maxMB * 1024 * 1024) throw new Error('Dosya boyutu sınırını aşıyor.');
  const path = 'assets/gallery-' + crypto.randomUUID() + '.' + allowed[extension];
  output[path] = file;
  return path;
}

async function change(nextItems, nextFiles, success, nextSite = site) {
  if (!ownerToken || busy) return false;
  busy = true;
  render();
  try {
    const mediaById = new Map(nextItems.map(item => [item.id, item]));
    for (const page of nextSite.pages) {
      for (const block of page.blocks) {
        if (block.mediaId && mediaById.get(block.mediaId)?.type !== block.type) {
          throw new Error('“' + page.title + '” sayfasında kullanılan medyanın türünü değiştirmeden önce ilgili bloğu düzenleyin.');
        }
      }
    }
    const used = new Set(nextItems.flatMap(item => [item.src, item.poster].filter(Boolean)));
    const retained = Object.fromEntries(Object.entries(nextFiles).filter(([path]) => used.has(path)));
    await saveDraft({ base, items:nextItems, files:retained, baseSite, site:nextSite });
    site = nextSite;
    items = nextItems;
    files = retained;
    pageEditor.render();
    message(success);
    return true;
  } catch (error) {
    message(error.message || 'Taslak kaydedilemedi.', true);
    return false;
  } finally {
    busy = false;
    render();
  }
}

async function move(index, offset) {
  const next = [...items];
  const destination = index + offset;
  [next[index], next[destination]] = [next[destination], next[index]];
  await change(next, files, 'Galeri sırası kaydedildi.');
}

async function remove(item) {
  const used = site.pages.some(page => page.blocks.some(block => block.mediaId === item.id));
  const detail = used ? ' Bu medyayı kullanan sayfa blokları da silinecek.' : '';
  if (!ownerToken || busy || !window.confirm('“' + item.title + '” taslaktan silinsin mi?' + detail)) return;
  const nextSite = used ? { pages:site.pages.map(page => ({
    ...page, blocks:page.blocks.filter(block => block.mediaId !== item.id)
  })) } : site;
  if (await change(items.filter(entry => entry.id !== item.id), files, 'Medya taslaktan silindi.', nextSite)) {
    if (editingId === item.id) editor.hidden = true;
  }
}

editor.addEventListener('submit', async event => {
  event.preventDefault();
  if (!ownerToken || busy) return;
  try {
    const original = items.find(item => item.id === editingId);
    const title = fields.title.value.trim();
    if (!title) throw new Error('Başlık girin.');
    const type = fields.type.value;
    const nextFiles = { ...files };
    const entry = {
      id:editingId ?? crypto.randomUUID(),
      title,
      type,
      src:original?.type === type ? original.src : '',
      label:fields.label.value.trim(),
      description:fields.description.value.trim()
    };
    if (fields.media.files[0] && type !== 'model') {
      entry.src = stageFile(fields.media.files[0], type === 'video' ? videoTypes : imageTypes, type === 'video' ? 20 : 8, nextFiles);
    }
    if (!entry.src) throw new Error('Bir medya dosyası seçin.');
    if (type === 'video') {
      const poster = fields.poster.files[0];
      if (poster) entry.poster = stageFile(poster, imageTypes, 8, nextFiles);
      else if (original?.poster) entry.poster = original.poster;
    }
    const next = original ? items.map(item => item.id === entry.id ? entry : item) : [...items, entry];
    if (await change(next, nextFiles, 'Medya taslağa kaydedildi.')) editor.hidden = true;
  } catch (error) {
    message(error.message, true);
  }
});

fields.type.addEventListener('change', updateFields);
get('add').addEventListener('click', () => openEditor());
get('cancel').addEventListener('click', () => { editor.hidden = true; });
get('reset-draft').addEventListener('click', async () => {
  if (!ownerToken || busy || !window.confirm('Yayımlanmamış site değişiklikleri silinsin mi?')) return;
  busy = true;
  render();
  try {
    const [fresh, freshSite] = await Promise.all([loadCatalog(), loadSite()]);
    await dropDraft();
    base = fresh;
    items = fresh;
    baseSite = site = freshSite;
    pageEditor.render();
    files = {};
    editor.hidden = true;
    message('Yayımdaki site içeriği yüklendi.');
  } catch (error) {
    message(error.message, true);
  } finally {
    busy = false;
    render();
  }
});

publishForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!ownerToken || busy) return;
  busy = true;
  render();
  message('Değişiklikler GitHub’a gönderiliyor…');
  try {
    await publishGallery({ repo:'fevzicakmak/carvingengineer', branch:'main', token:ownerToken, base, items, files, baseSite, site });
    base = items;
    baseSite = site;
    files = {};
    await dropDraft().catch(() => saveDraft({base, items, files, baseSite, site})).catch(() => {});
    message('Site içeriği GitHub’a kaydedildi. GitHub Pages dağıtımı tamamlanınca site güncellenecek.');
  } catch (error) {
    message(error.message, true);
  } finally {
    busy = false;
    render();
  }
});

unlockForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const tokenField = unlockForm.elements.token;
  const token = tokenField.value.trim();
  tokenField.value = '';
  if (!token) return;
  const submit = unlockForm.querySelector('button');
  busy = true;
  submit.disabled = true;
  message('GitHub hesabı doğrulanıyor…');
  try {
    await verifyOwner(token);
    const draft = await loadDraft();
    base = draft?.base ?? await loadCatalog();
    items = draft?.items ?? base;
    files = draft?.files ?? {};
    baseSite = draft?.baseSite ?? await loadSite();
    site = draft?.site ?? baseSite;
    pageEditor.render();
    ownerToken = token;
    get('access').hidden = true;
    get('management').hidden = false;
    message('Yönetim ekranı açıldı.');
  } catch (error) {
    message(error.message || 'Yönetim ekranı açılamadı.', true);
  } finally {
    busy = false;
    submit.disabled = false;
    if (ownerToken) {
      render();
      get('show-pages').focus();
    }
  }
});

get('lock').addEventListener('click', () => {
  if (busy) return;
  previewWindow?.close();
  location.reload();
});

function openPreview(slug) {
  if (!ownerToken || busy) return;
  previewWindow?.close();
  previewWindow = window.open(pageUrl(slug, true), '_blank');
  if (!previewWindow) message('Önizleme sekmesi engellendi.', true);
}
get('preview').addEventListener('click', () => openPreview());

window.addEventListener('message', event => {
  if (!ownerToken || !previewWindow || event.origin !== location.origin ||
      event.source !== previewWindow || event.data !== 'gallery-preview-ready') return;
  previewWindow.postMessage({ type:'gallery-preview', items, files, site }, location.origin);
});


function importFiles(selected, output, expectedType) {
  return [...selected].map(file => {
    const extension = file.name.split('.').pop().toLowerCase();
    const type = Object.hasOwn(videoTypes, extension) ? 'video' : 'image';
    if (expectedType && type !== expectedType) throw new Error('Bu blok için ' + types[expectedType].toLocaleLowerCase('tr') + ' dosyası seçin.');
    return {
      id:crypto.randomUUID(),
      title:file.name.replace(/\.[^.]+$/, '').slice(0, 100) || types[type],
      type, src:stageFile(file, type === 'video' ? videoTypes : imageTypes, type === 'video' ? 20 : 8, output)
    };
  });
}

async function importGallery(selected) {
  if (!ownerToken || busy || !selected.length) return;
  try {
    const nextFiles = { ...files };
    const imported = importFiles(selected, nextFiles);
    await change([...items, ...imported], nextFiles, 'Medya kütüphaneye eklendi.');
  } catch (error) {
    message(error.message, true);
  }
}

async function addPageMedia({ selected, page, current, type, fit }) {
  if (!ownerToken || busy || !selected.length) return false;
  try {
    const nextFiles = { ...files };
    const imported = importFiles(selected, nextFiles, type);
    const blocks = imported.map((item, index) => ({
      id:index === 0 && current ? current.id : crypto.randomUUID(),
      type, mediaId:item.id, fit
    }));
    const nextBlocks = current ? page.blocks.flatMap(block => block.id === current.id ? blocks : [block]) : [...page.blocks, ...blocks];
    const nextSite = { pages:site.pages.map(entry => entry.id === page.id ? { ...entry, blocks:nextBlocks } : entry) };
    return change([...items, ...imported], nextFiles, 'Medya sayfaya ve kütüphaneye eklendi.', nextSite);
  } catch (error) {
    message(error.message, true);
    return false;
  }
}

get('media-files').addEventListener('change', async event => {
  const field = event.currentTarget;
  await importGallery(field.files);
  field.value = '';
});
const mediaDrop = get('media-drop');
mediaDrop.addEventListener('dragover', event => {
  event.preventDefault();
  if (!busy) mediaDrop.classList.add('drop-target');
});
mediaDrop.addEventListener('dragleave', () => mediaDrop.classList.remove('drop-target'));
mediaDrop.addEventListener('drop', event => {
  event.preventDefault();
  mediaDrop.classList.remove('drop-target');
  if (event.dataTransfer.files.length) importGallery(event.dataTransfer.files);
});
