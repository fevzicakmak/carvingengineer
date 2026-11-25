export const types = { image: 'Görsel', video: 'Video', model: '3B model' };

export async function loadCatalog() {
  const response = await fetch('./gallery.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Galeri içeriği yüklenemedi.');
  return response.json();
}

function draftTransaction(mode, operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('carvingengineer', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('gallery');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('gallery', mode);
      const result = operation(transaction.objectStore('gallery'));
      transaction.oncomplete = () => { db.close(); resolve(result.result); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  });
}

export const loadDraft = () => draftTransaction('readonly', store => store.get('draft'));
export const saveDraft = draft => draftTransaction('readwrite', store => store.put(draft, 'draft'));
export const dropDraft = () => draftTransaction('readwrite', store => store.delete('draft'));
