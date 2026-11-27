export const blockTypes = {
  heading: 'Başlık', text: 'Metin', image: 'Görsel', video: 'Video',
  link: 'Bağlantı', divider: 'Ayırıcı'
};

export const emptySite = () => ({ pages: [] });

export function slugify(value) {
  return value.toLocaleLowerCase('tr').replaceAll('ı', 'i')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '');
}

export function pageUrl(slug, draft = false) {
  const query = new URLSearchParams();
  if (slug) query.set('sayfa', slug);
  if (draft) query.set('taslak', '1');
  return './' + (query.size ? '?' + query.toString() : '');
}

export function validatedUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}

export function moveEntry(list, from, to) {
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
