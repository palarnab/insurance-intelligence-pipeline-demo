const BASE = import.meta.env.VITE_API_BASE || '/api';

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  async health() {
    return json(await fetch(`${BASE}/health`));
  },
  async getQueue(limit = 25) {
    return json(await fetch(`${BASE}/queue?limit=${limit}`));
  },
  async listDocuments() {
    return json(await fetch(`${BASE}/documents`));
  },
  async getDocument(id) {
    return json(await fetch(`${BASE}/documents/${id}`));
  },
  async uploadDocument(file) {
    const form = new FormData();
    form.append('document', file);
    return json(await fetch(`${BASE}/documents`, { method: 'POST', body: form }));
  },
  async deleteDocument(id) {
    return json(await fetch(`${BASE}/documents/${id}`, { method: 'DELETE' }));
  },
};
