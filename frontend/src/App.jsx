import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import UploadPanel from './components/UploadPanel.jsx';
import DocumentList from './components/DocumentList.jsx';
import DocumentDetail from './components/DocumentDetail.jsx';
import QueueViewer from './components/QueueViewer.jsx';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [health, setHealth] = useState(null);
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const refreshList = useCallback(async () => {
    try {
      const { items } = await api.listDocuments();
      setDocuments(items);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await api.health());
    } catch {
      setHealth({ status: 'unreachable' });
    }
  }, []);

  const refreshQueue = useCallback(async () => {
    try {
      setQueue(await api.getQueue(25));
    } catch {
      /* transient */
    }
  }, []);

  const refreshDetail = useCallback(async (id) => {
    if (!id) return setDetail(null);
    try {
      const { document } = await api.getDocument(id);
      setDetail(document);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refreshList();
    refreshHealth();
    refreshQueue();
    pollRef.current = setInterval(() => {
      refreshList();
      refreshHealth();
      refreshQueue();
    }, 2500);
    return () => clearInterval(pollRef.current);
  }, [refreshList, refreshHealth, refreshQueue]);

  useEffect(() => {
    refreshDetail(selectedId);
    if (!selectedId) return;
    const t = setInterval(() => refreshDetail(selectedId), 2000);
    return () => clearInterval(t);
  }, [selectedId, refreshDetail]);

  const onUploaded = async (documentId) => {
    await refreshList();
    setSelectedId(documentId);
  };

  const onDelete = async (id) => {
    await api.deleteDocument(id).catch(() => {});
    if (selectedId === id) setSelectedId(null);
    refreshList();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">IIP</span>
          <div>
            <h1>Insurance Intelligence Pipeline</h1>
            <p>OCR · NLP · LLM conflict detection for insurance documents</p>
          </div>
        </div>
        <HealthPill health={health} />
      </header>

      {error && <div className="banner error">{error}</div>}

      <main className="layout">
        <section className="col col-left">
          <UploadPanel onUploaded={onUploaded} onError={setError} />
          <DocumentList
            documents={documents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={onDelete}
          />
          <QueueViewer queue={queue} onSelectDocument={setSelectedId} />
        </section>
        <section className="col col-right">
          <DocumentDetail document={detail} />
        </section>
      </main>
    </div>
  );
}

function HealthPill({ health }) {
  if (!health) return null;
  const ok = health.status === 'ok';
  return (
    <div className={`health-pill ${ok ? 'ok' : 'bad'}`} title={JSON.stringify(health.dependencies || {})}>
      <span className="dot" />
      {ok ? 'System healthy' : `System ${health.status}`}
      {health.queue && (
        <span className="queue-mini">
          &nbsp;· {health.queue.active || 0} active / {health.queue.pending || 0} pending / {health.queue.failed || 0} failed
        </span>
      )}
    </div>
  );
}
