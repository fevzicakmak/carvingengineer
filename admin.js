import { loadCatalog, loadDraft, saveDraft, dropDraft, types } from './catalog.js';
import { publishGallery, verifyOwner } from './github.js';

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
let files = {};
let editingId = null;
let busy = false;
let ownerToken = '';
let previewWindow;

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
    row.append(name, controls);
    return row;
  }));
  if (!items.length) list.textContent = 'Galeride henüz içerik yok.';
  const changed = JSON.stringify(items) !== JSON.stringify(base);
  get('add').disabled = busy;
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

async function change(nextItems, nextFiles, success) {
  if (!ownerToken || busy) return false;
  busy = true;
  render();
  try {
    const used = new Set(nextItems.flatMap(item => [item.src, item.poster].filter(Boolean)));
    const retained = Object.fromEntries(Object.entries(nextFiles).filter(([path]) => used.has(path)));
    await saveDraft({ base, items:nextItems, files:retained });
    items = nextItems;
    files = retained;
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
  if (!window.confirm('“' + item.title + '” taslak galeriden silinsin mi?')) return;
  if (await change(items.filter(entry => entry.id !== item.id), files, 'Medya taslaktan silindi.')) {
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
  if (!ownerToken || busy || !window.confirm('Yayımlanmamış galeri değişiklikleri silinsin mi?')) return;
  busy = true;
  render();
  try {
    const fresh = await loadCatalog();
    await dropDraft();
    base = fresh;
    items = fresh;
    files = {};
    editor.hidden = true;
    message('Yayımdaki galeri yüklendi.');
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
    await publishGallery({ repo:'fevzicakmak/carvingengineer', branch:'main', token:ownerToken, base, items, files });
    base = items;
    files = {};
    await dropDraft().catch(() => saveDraft({base, items, files})).catch(() => {});
    message('Galeri GitHub’a kaydedildi. GitHub Pages dağıtımı tamamlanınca site güncellenecek.');
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
      get('add').focus();
    }
  }
});

get('lock').addEventListener('click', () => {
  if (busy) return;
  previewWindow?.close();
  location.reload();
});

get('preview').addEventListener('click', () => {
  if (!ownerToken || busy) return;
  previewWindow?.close();
  previewWindow = window.open('./?taslak=1', '_blank');
  if (!previewWindow) message('Önizleme sekmesi engellendi.', true);
});

window.addEventListener('message', event => {
  if (!ownerToken || !previewWindow || event.origin !== location.origin ||
      event.source !== previewWindow || event.data !== 'gallery-preview-ready') return;
  previewWindow.postMessage({ type:'gallery-preview', items, files }, location.origin);
});
