import { blockTypes, moveEntry, slugify, validatedUrl } from './site-content.js';
import { dragHandle } from './drag-order.js';

export function createPageEditor({ getSite, getMedia, save, preview, report, openMedia, uploadMedia }) {
  const get = id => document.getElementById(id);
  const pageForm = get('page-settings');
  const blockForm = get('block-settings');
  const pageFields = pageForm.elements;
  const blockFields = blockForm.elements;
  let selectedPage;
  let selectedBlock;
  let pendingType;
  let busy = false;

  const activePage = () => getSite().pages.find(page => page.id === selectedPage);
  const activeBlock = () => activePage()?.blocks.find(block => block.id === selectedBlock);

  function action(label, run, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', run);
    return button;
  }

  function selectOptions(select, options, value) {
    select.replaceChildren(...options.map(([id, title]) => new Option(title, id)));
    select.value = value;
  }

  function replacePage(page) {
    return { pages: getSite().pages.map(item => item.id === page.id ? page : item) };
  }

  function reorder(entries, from, to, apply) {
    const first = entries.findIndex(entry => entry.id === from);
    const last = entries.findIndex(entry => entry.id === to);
    if (!busy && first >= 0 && last >= 0 && first !== last) apply(moveEntry(entries, first, last));
  }

  function row(group, id, title, items, index, select, apply) {
    const line = document.createElement('div');
    line.className = 'builder-row';
    const name = action(title, select);
    name.className = 'builder-row-title';
    name.setAttribute('aria-pressed', String(group === 'pages' ? id === selectedPage : id === selectedBlock));
    line.append(
      dragHandle(line, group, id, (from, to) => reorder(items, from, to, apply)),
      name,
      action('↑', () => apply(moveEntry(items, index, index - 1)), index === 0),
      action('↓', () => apply(moveEntry(items, index, index + 1)), index === items.length - 1)
    );
    line.children[2].ariaLabel = title + ' yukarı taşı';
    line.children[3].ariaLabel = title + ' aşağı taşı';
    return line;
  }

  function selectPage(id) {
    selectedPage = id;
    selectedBlock = pendingType = null;
    render();
  }

  function renderBlockForm(block, type) {
    blockForm.hidden = !type;
    if (!type) return;
    get('block-heading').textContent = blockTypes[type];
    const isText = type === 'text' || type === 'heading';
    const isMedia = type === 'image' || type === 'video';
    get('block-text-field').hidden = !isText;
    get('block-typography').hidden = !isText;
    get('block-media-field').hidden = !isMedia;
    get('block-fit-field').hidden = !isMedia;
    get('block-link-fields').hidden = type !== 'link';
    get('block-delete').hidden = !block;
    blockFields.text.required = isText;
    blockFields.text.value = block?.text ?? '';
    blockFields.align.value = block?.align ?? 'left';
    blockFields.size.value = block?.size ?? 'normal';
    blockFields.tone.value = block?.tone ?? 'ink';
    blockFields.face.value = block?.face ?? (type === 'heading' ? 'serif' : 'sans');
    blockFields.bold.checked = block?.bold ?? false;
    blockFields.italic.checked = block?.italic ?? false;
    blockFields.fit.value = block?.fit ?? 'wide';
    if (isMedia) {
      get('block-files').value = '';
      get('block-files').accept = type === 'video' ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp,image/gif,image/avif';
      const media = getMedia().filter(item => item.type === type);
      selectOptions(blockFields.media, [['', 'Medya seçin'], ...media.map(item => [item.id, item.title])], block?.mediaId ?? '');
    }
    if (type === 'link') {
      selectOptions(blockFields.target, [['external', 'URL gir'], ['home', 'Ana sayfa'],
        ...getSite().pages.map(page => [page.id, page.title])], block?.target ?? 'external');
      blockFields.caption.value = block?.caption ?? '';
      blockFields.href.value = block?.href ?? '';
      get('block-url-field').hidden = blockFields.target.value !== 'external';
    }
  }

  function render() {
    const { pages } = getSite();
    const page = activePage();
    const applyPages = next => save({ pages: next }, 'Sayfalar sıralandı.');
    get('pages-list').replaceChildren(...pages.map((item, index) =>
      row('pages', item.id, item.title, pages, index, () => selectPage(item.id), applyPages)));
    get('page-workspace').hidden = !page;
    get('pages-empty').hidden = Boolean(page);
    if (!page) { blockForm.hidden = true; return; }
    pageFields.title.value = page.title;
    pageFields.slug.value = page.slug;
    pageFields.menu.checked = page.menu;
    get('page-address').textContent = 'carvingengineer.com/?sayfa=' + page.slug;
    const applyBlocks = blocks => save(replacePage({ ...page, blocks }), 'Sayfa blokları sıralandı.');
    get('blocks-list').replaceChildren(...page.blocks.map((item, index) => {
      const title = item.text?.split('\n')[0] || item.caption ||
        getMedia().find(media => media.id === item.mediaId)?.title || blockTypes[item.type];
      return row('blocks', item.id, title.slice(0, 68), page.blocks, index, () => {
        selectedBlock = item.id;
        pendingType = null;
        render();
      }, applyBlocks);
    }));
    get('blocks-empty').hidden = page.blocks.length > 0;
    renderBlockForm(activeBlock(), activeBlock()?.type || pendingType);
  }

  get('new-page').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const title = event.currentTarget.elements.title.value.trim();
    const prefix = slugify(title);
    if (!prefix) return report('Sayfa başlığında en az bir harf veya rakam kullanın.', true);
    const slugs = new Set(getSite().pages.map(page => page.slug));
    let slug = prefix;
    for (let number = 2; slugs.has(slug); number++) slug = prefix.slice(0, 64) + '-' + number;
    const page = { id:crypto.randomUUID(), title, slug, menu:true, blocks:[] };
    const form = event.currentTarget;
    if (await save({ pages:[...getSite().pages, page] }, 'Sayfa taslağa eklendi.')) {
      form.reset();
      selectPage(page.id);
    }
  });

  pageForm.addEventListener('submit', async event => {
    event.preventDefault();
    const page = activePage();
    if (!page || busy) return;
    const title = pageFields.title.value.trim();
    const slug = slugify(pageFields.slug.value);
    if (!title || !slug) return report('Sayfa başlığını ve adresini girin.', true);
    if (getSite().pages.some(item => item.id !== page.id && item.slug === slug)) {
      return report('Bu sayfa adresi zaten kullanılıyor.', true);
    }
    await save(replacePage({ ...page, title, slug, menu:pageFields.menu.checked }), 'Sayfa ayarları kaydedildi.');
  });

  get('page-delete').addEventListener('click', async () => {
    const page = activePage();
    if (!page || busy || !confirm('“' + page.title + '” sayfası ve ona giden site içi bağlantılar taslaktan silinsin mi?')) return;
    const pages = getSite().pages.filter(item => item.id !== page.id).map(item => ({
      ...item, blocks:item.blocks.filter(block => block.type !== 'link' || block.target !== page.id)
    }));
    if (await save({ pages }, 'Sayfa taslaktan silindi.')) selectPage(pages[0]?.id);
  });

  get('block-types').addEventListener('click', event => {
    const type = event.target.closest('[data-block]')?.dataset.block;
    if (!type || busy || !activePage()) return;
    selectedBlock = null;
    pendingType = type;
    renderBlockForm(null, type);
  });
  blockFields.target.addEventListener('change', () => {
    get('block-url-field').hidden = blockFields.target.value !== 'external';
  });

  blockForm.addEventListener('submit', async event => {
    event.preventDefault();
    const page = activePage();
    if (!page || busy) return;
    const current = activeBlock();
    const type = current?.type || pendingType;
    if (!type) return;
    const block = { id:current?.id ?? crypto.randomUUID(), type };
    if (type === 'heading' || type === 'text') {
      const text = blockFields.text.value.trim();
      if (!text) return report('Blok metnini girin.', true);
      Object.assign(block, { text, align:blockFields.align.value, size:blockFields.size.value,
        tone:blockFields.tone.value, face:blockFields.face.value, bold:blockFields.bold.checked,
        italic:blockFields.italic.checked });
    }
    if (type === 'image' || type === 'video') {
      const mediaId = blockFields.media.value;
      if (!getMedia().some(item => item.id === mediaId && item.type === type)) {
        return report('Medya kütüphanesinden bir dosya seçin.', true);
      }
      Object.assign(block, { mediaId, fit:blockFields.fit.value });
    }
    if (type === 'link') {
      const caption = blockFields.caption.value.trim();
      const target = blockFields.target.value;
      const href = target === 'external' ? validatedUrl(blockFields.href.value.trim()) : '';
      if (!caption || (target === 'external' && !href)) return report('Bağlantı metnini ve geçerli bir adresi girin.', true);
      Object.assign(block, { caption, target, href });
    }
    const blocks = current ? page.blocks.map(item => item.id === block.id ? block : item) : [...page.blocks, block];
    if (await save(replacePage({ ...page, blocks }), 'Blok taslağa kaydedildi.')) {
      selectedBlock = pendingType = null;
      render();
    }
  });

  get('block-delete').addEventListener('click', async () => {
    const page = activePage();
    const block = activeBlock();
    if (!page || !block || busy || !confirm('Bloğu taslaktan silmek istiyor musunuz?')) return;
    if (await save(replacePage({ ...page, blocks:page.blocks.filter(item => item.id !== block.id) }), 'Blok silindi.')) {
      selectedBlock = null;
      render();
    }
  });
  get('block-cancel').addEventListener('click', () => {
    selectedBlock = pendingType = null;
    render();
  });
  async function putFiles(selected) {
    const page = activePage();
    const current = activeBlock();
    const type = current?.type || pendingType;
    if (!page || busy || (type !== 'image' && type !== 'video')) return;
    if (await uploadMedia({ selected, page, current, type, fit:blockFields.fit.value })) {
      selectedBlock = pendingType = null;
      render();
    }
  }
  get('block-files').addEventListener('change', async event => {
    const field = event.currentTarget;
    await putFiles(field.files);
    field.value = '';
  });
  const dropZone = get('block-drop');
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    if (!busy) dropZone.classList.add('drop-target');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-target'));
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('drop-target');
    if (event.dataTransfer.files.length) putFiles(event.dataTransfer.files);
  });
  get('block-open-media').addEventListener('click', openMedia);
  get('preview-page').addEventListener('click', () => {
    const page = activePage();
    if (page && !busy) preview(page.slug);
  });

  return {
    render,
    setBusy(value) { busy = value; }
  };
}
