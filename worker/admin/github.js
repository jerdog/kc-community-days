// Minimal GitHub REST client that acts with the signed-in admin's own OAuth token.
export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function github(token, env) {
  const apiBase = env.GITHUB_API || 'https://api.github.com';
  const repo = env.ADMIN_REPO;

  async function api(path, { method = 'GET', body, ok = [] } = {}) {
    const res = await fetch(`${apiBase}${path.replace('{repo}', `repos/${repo}`)}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'communitydays-admin',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (ok.includes(res.status)) return { status: res.status, data: null };
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        msg = (await res.json()).message || msg;
      } catch {}
      throw new GitHubError(res.status, `GitHub: ${msg}`);
    }
    return { status: res.status, data: res.status === 204 ? null : await res.json() };
  }

  const b64ToText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

  return {
    user: async () => (await api('/user')).data,
    repo: async () => (await api('/{repo}')).data,

    async refSha(branch) {
      const r = await api(`/{repo}/git/ref/heads/${encodeURIComponent(branch)}`, { ok: [404] });
      return r.data ? r.data.object.sha : null;
    },
    createRef: (branch, sha) => api('/{repo}/git/refs', { method: 'POST', body: { ref: `refs/heads/${branch}`, sha } }),
    deleteRef: (branch) => api(`/{repo}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'DELETE', ok: [404, 422] }),

    async readText(path, ref) {
      const r = await api(`/{repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, { ok: [404] });
      if (!r.data) return null;
      if (r.data.content == null || r.data.encoding !== 'base64' || r.data.size > 900000) {
        const blob = (await api(`/{repo}/git/blobs/${r.data.sha}`)).data;
        return b64ToText(blob.content);
      }
      return b64ToText(r.data.content);
    },
    async listDir(path, ref) {
      const r = await api(`/{repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, { ok: [404] });
      return Array.isArray(r.data) ? r.data : [];
    },

    // One commit with several files. `files`: [{ path, text } | { path, base64 } | { path, remove: true }].
    // Fails with 409 if `branch` no longer points at `parent` (someone else saved first).
    async commit(branch, parent, files, message) {
      const parentCommit = (await api(`/{repo}/git/commits/${parent}`)).data;
      const tree = [];
      for (const f of files) {
        if (f.remove) {
          tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
        } else if (f.base64 != null) {
          const blob = (await api('/{repo}/git/blobs', { method: 'POST', body: { content: f.base64, encoding: 'base64' } })).data;
          tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
        } else {
          tree.push({ path: f.path, mode: '100644', type: 'blob', content: f.text });
        }
      }
      const newTree = (await api('/{repo}/git/trees', { method: 'POST', body: { base_tree: parentCommit.tree.sha, tree } })).data;
      const commit = (await api('/{repo}/git/commits', { method: 'POST', body: { message, tree: newTree.sha, parents: [parent] } })).data;
      try {
        await api(`/{repo}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
      } catch (e) {
        if (e.status === 422) throw new GitHubError(409, 'Someone else saved changes in the meantime. Reload to see them, then make your change again.');
        throw e;
      }
      return commit.sha;
    },

    async compare(base, head) {
      const r = (await api(`/{repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`)).data;
      return { ahead: r.ahead_by, behind: r.behind_by, files: (r.files || []).map((f) => f.filename), commits: (r.commits || []).map((c) => ({ sha: c.sha, message: c.commit.message.split('\n')[0], author: c.author?.login || c.commit.author?.name })) };
    },

    // Merge head into base. Returns the merge commit sha, or null if there was nothing to merge.
    async merge(base, head, message) {
      const r = await api('/{repo}/merges', { method: 'POST', body: { base, head, commit_message: message }, ok: [204, 409] });
      if (r.status === 409) throw new GitHubError(409, 'The draft conflicts with changes made on the live site since it was started. Discard the draft and make your changes again.');
      return r.data?.sha || null;
    },
  };
}
