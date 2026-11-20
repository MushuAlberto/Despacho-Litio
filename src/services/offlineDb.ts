import { saveOperationalReportToFirebase, logActivity, SystemUser } from './firebase';

const DB_NAME = 'despacho_litio_offline_db';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'operational_snapshots';
const OUTBOX_STORE = 'sync_outbox_queue';

export type OutboxMutationType = 'report' | 'stokes_upload' | 'shift_handoff';

export interface OperationalSnapshot<T = unknown> {
  key: string;
  data: T;
  updatedAt: string;
  recordCount?: number;
}

export interface OutboxMutationItem {
  id: string;
  type: OutboxMutationType;
  label: string;
  payload: Record<string, any>;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}

type OutboxListener = (queue: OutboxMutationItem[], isSyncing: boolean) => void;

const listeners = new Set<OutboxListener>();
let activeSyncPromise: Promise<{ synced: number; failed: number }> | null = null;
let isSyncingNow = false;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB no disponible en este entorno.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
        outbox.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error abriendo IndexedDB'));
  });
}

async function notifyListeners(): Promise<void> {
  const items = await getOutboxQueue().catch(() => []);
  listeners.forEach((cb) => {
    try {
      cb(items, isSyncingNow);
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function subscribeOutbox(listener: OutboxListener): () => void {
  listeners.add(listener);
  getOutboxQueue()
    .then((items) => listener(items, isSyncingNow))
    .catch(() => listener([], isSyncingNow));

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Almacena un snapshot operacional crítico en IndexedDB (estado Stokes, datos base o turno).
 */
export async function saveOperationalSnapshot<T>(
  key: string,
  data: T,
  recordCount?: number
): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const record: OperationalSnapshot<T> = {
        key,
        data,
        updatedAt: new Date().toISOString(),
        recordCount,
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[OfflineDB] No se pudo guardar snapshot en IndexedDB:', err);
  }
}

/**
 * Recupera un snapshot operacional desde IndexedDB para operación sin conexión.
 */
export async function getOperationalSnapshot<T>(key: string): Promise<OperationalSnapshot<T> | null> {
  if (!hasIndexedDB()) return null;
  try {
    const db = await openOfflineDB();
    const result = await new Promise<OperationalSnapshot<T> | null>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as OperationalSnapshot<T>) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

/**
 * Lee toda la cola FIFO de mutaciones pendientes en IndexedDB.
 */
export async function getOutboxQueue(): Promise<OutboxMutationItem[]> {
  if (!hasIndexedDB()) return [];
  try {
    const db = await openOfflineDB();
    const items = await new Promise<OutboxMutationItem[]>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readonly');
      const store = tx.objectStore(OUTBOX_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as OutboxMutationItem[]) || [];
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items;
  } catch {
    return [];
  }
}

async function putOutboxItem(item: OutboxMutationItem): Promise<void> {
  const db = await openOfflineDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function removeOutboxItem(id: string): Promise<void> {
  const db = await openOfflineDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Encola una operación crítica (reporte, carga Stokes o cambio de turno) en IndexedDB
 * y registra Background Sync si el navegador lo soporta.
 */
export async function enqueueOfflineMutation(
  type: OutboxMutationType,
  label: string,
  payload: Record<string, any>
): Promise<OutboxMutationItem> {
  const item: OutboxMutationItem = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    label,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  };

  if (hasIndexedDB()) {
    await putOutboxItem(item);
    await notifyListeners();

    // Solicitar Background Sync nativo (Chromium/Android) como respaldo adicional
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg: any) => {
          if (reg.sync && typeof reg.sync.register === 'function') {
            return reg.sync.register('despacho-litio-outbox');
          }
        })
        .catch(() => {
          // Safari iOS no soporta Background Sync API; el listener 'online' cubre la reconexión.
        });
    }
  }

  return item;
}

async function dispatchSingleMutation(item: OutboxMutationItem): Promise<void> {
  const user = (item.payload.user as SystemUser | null) || null;

  if (item.type === 'report') {
    const date = String(item.payload.date || new Date().toISOString().slice(0, 10));
    const backupObj = item.payload.backupDataObj || {};
    const summary = typeof item.payload.summary === 'string' ? item.payload.summary : undefined;
    const ok = await saveOperationalReportToFirebase(date, backupObj, user, summary);
    if (!ok) {
      throw new Error('Firebase rechazó o no pudo confirmar el guardado del informe.');
    }
    return;
  }

  if (item.type === 'stokes_upload') {
    const summary = item.payload.summary || {};
    await logActivity(
      user,
      'Sincronizó Reporte Stokes (Offline-First)',
      `Sincronizó lote Stokes: ${summary.validCount ?? 0} guías válidas (${summary.totalTonnage ?? 0} TON), ${summary.quarantinedCount ?? 0} en cuarentena.`
    );
    return;
  }

  if (item.type === 'shift_handoff') {
    const title = String(item.payload.title || 'Cambio de Turno');
    const summaryText = String(item.payload.summaryText || 'Registro de análisis de turno.');
    await logActivity(
      user,
      `Sincronizó ${title}`,
      summaryText.slice(0, 800)
    );
  }
}

/**
 * Procesa en orden FIFO todas las mutaciones encoladas cuando hay conexión de red.
 */
export async function flushOutboxQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    isSyncingNow = true;
    await notifyListeners();

    let synced = 0;
    let failed = 0;

    try {
      const queue = await getOutboxQueue();
      for (const item of queue) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;

        try {
          await putOutboxItem({ ...item, status: 'syncing' });
          await notifyListeners();

          await dispatchSingleMutation(item);
          await removeOutboxItem(item.id);
          synced++;
        } catch (err: any) {
          failed++;
          await putOutboxItem({
            ...item,
            attempts: item.attempts + 1,
            status: 'failed',
            lastError: err?.message || String(err),
          });
        }
      }
    } finally {
      isSyncingNow = false;
      activeSyncPromise = null;
      await notifyListeners();
    }

    return { synced, failed };
  })();

  return activeSyncPromise;
}

let autoSyncInitialized = false;

/**
 * Registra listeners globales de conectividad para sincronizar automáticamente
 * la cola IndexedDB al recuperar red o volver al foco de la PWA.
 */
export function initOfflineSyncLifecycle(): () => void {
  if (typeof window === 'undefined' || autoSyncInitialized) {
    return () => {};
  }
  autoSyncInitialized = true;

  const triggerFlush = () => {
    if (navigator.onLine) {
      flushOutboxQueue().catch((err) => console.warn('[OfflineDB] Error en flush automático:', err));
    }
  };

  window.addEventListener('online', triggerFlush);
  window.addEventListener('focus', triggerFlush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerFlush();
    }
  });

  if (navigator.onLine) {
    setTimeout(triggerFlush, 1500);
  }

  return () => {
    window.removeEventListener('online', triggerFlush);
    window.removeEventListener('focus', triggerFlush);
    autoSyncInitialized = false;
  };
}
