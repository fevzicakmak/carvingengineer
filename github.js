const api = 'https://api.github.com';

function base64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function publishGallery({ repo, branch, token, base, items, files }) {
  const path = `/repos/${repo}`;
  const branchPath = branch.split('/').map(encodeURIComponent).join('/');
  async function request(endpoint, method = 'GET', body, raw = false) {
    const response = await fetch(api + path + endpoint, {
      method,
      headers: {
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`GitHub ${response.status}. ${error.message || 'Depo, dal ve anahtar izinlerini kontrol edin.'}`);
    }
    return response.json();
  }

  const ref = await request(`/git/ref/heads/${branchPath}`);
  const head = ref.object.sha;
  const live = await request(`/contents/gallery.json?ref=${head}`, 'GET', undefined, true);
  if (JSON.stringify(live) !== JSON.stringify(base)) {
    throw new Error('Yayımdaki galeri bu taslak açıldıktan sonra değişmiş. Taslağı önizleyip değişikliklerinizi kaydedin, ardından son galeriyi yüklemek için taslağı sıfırlayın.');
  }
  const commit = await request(`/git/commits/${head}`);
  const tree = [{ path:'gallery.json', mode:'100644', type:'blob', content:JSON.stringify(items, null, 2) + '\n' }];
  const used = new Set(items.flatMap(item => [item.src, item.poster].filter(Boolean)));
  for (const [filePath, file] of Object.entries(files)) {
    if (!used.has(filePath)) continue;
    const blob = await request('/git/blobs', 'POST', { content:await base64(file), encoding:'base64' });
    tree.push({ path:filePath, mode:'100644', type:'blob', sha:blob.sha });
  }

  const oldUsed = new Set(base.flatMap(item => [item.src, item.poster].filter(Boolean)));
  for (const filePath of oldUsed) {
    if (filePath.startsWith('assets/gallery-') && !used.has(filePath)) {
      tree.push({ path:filePath, mode:'100644', type:'blob', sha:null });
    }
  }
  const updatedTree = await request('/git/trees', 'POST', { base_tree:commit.tree.sha, tree });
  const updatedCommit = await request('/git/commits', 'POST', {
    message:'Galeri içeriğini güncelle',
    tree:updatedTree.sha,
    parents:[head]
  });
  await request(`/git/refs/heads/${branchPath}`, 'PATCH', { sha:updatedCommit.sha, force:false });
  return updatedCommit.sha;
}

export async function verifyOwner(token) {
  const response = await fetch(api + '/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    cache: 'no-store'
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('GitHub erişim anahtarı kabul edilmedi.');
  }
  if (!response.ok) throw new Error('GitHub hesabı şu anda doğrulanamadı.');
  const account = await response.json();
  if (account.id !== 218658870) throw new Error('Bu ekran yalnızca site sahibine açıktır.');
}
