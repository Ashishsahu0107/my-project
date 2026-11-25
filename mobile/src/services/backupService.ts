import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';

const LAST_SYNC_KEY = 'chatapp_last_sync_at';
const RESTORED_IDS_KEY = 'chatapp_restored_message_ids';

export type BackupFrequency = 'daily' | 'weekly' | 'manual';

export type BackupStatus = {
  hasBackup: boolean;
  status: 'completed' | 'failed';
  autoBackupEnabled: boolean;
  autoBackupFrequency: BackupFrequency;
  lastBackupAt: string | null;
  lastSyncAt: string | null;
  stats: {
    roomCount: number;
    messageCount: number;
    mediaCount: number;
    sizeBytes: number;
  };
  lastError?: string;
};

export async function getBackupStatus(): Promise<BackupStatus> {
  const response = await api.get('/backup/status');
  return response.data.data;
}

export async function updateBackupSettings(settings: {
  autoBackupEnabled?: boolean;
  autoBackupFrequency?: BackupFrequency;
}): Promise<{ autoBackupEnabled: boolean; autoBackupFrequency: BackupFrequency }> {
  const response = await api.put('/backup/settings', settings);
  return response.data.data;
}

export async function createBackup(
  onProgress?: (progress: number, label: string) => void
): Promise<{
  lastBackupAt: string;
  stats: BackupStatus['stats'];
  checksum: string;
}> {
  onProgress?.(0.2, 'Collecting conversations & media...');
  const timer1 = setTimeout(() => onProgress?.(0.55, 'Encrypting & uploading backup...'), 250);
  try {
    const response = await api.post('/backup/create');
    clearTimeout(timer1);
    onProgress?.(0.9, 'Finalizing backup...');
    const data = response.data.data;
    if (data?.lastBackupAt) {
      await SecureStore.setItemAsync(LAST_SYNC_KEY, data.lastBackupAt).catch(() => {});
    }
    onProgress?.(1, 'Backup completed');
    return data;
  } catch (err) {
    clearTimeout(timer1);
    throw err;
  }
}

export async function restoreBackup(
  onProgress?: (progress: number, label: string) => void
): Promise<{
  lastBackupAt: string;
  restoredAt: string;
  stats: { roomCount: number; messageCount: number; mediaCount: number };
  rooms: any[];
  messages: any[];
  media: any[];
  skippedDuplicates: number;
}> {
  onProgress?.(0.2, 'Downloading encrypted backup...');
  const response = await api.post('/backup/restore');
  onProgress?.(0.65, 'Verifying checksum & deduplicating...');

  const data = response.data.data;

  // Deduplicate against already-restored IDs on this device
  let existingIds = new Set<string>();
  try {
    const raw = await SecureStore.getItemAsync(RESTORED_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) existingIds = new Set(parsed);
    }
  } catch {}

  const uniqueMessages: any[] = [];
  let skippedDuplicates = 0;

  for (const msg of data.messages || []) {
    const id = String(msg._id || '');
    if (!id) continue;
    if (existingIds.has(id)) {
      skippedDuplicates += 1;
      uniqueMessages.push(msg);
    } else {
      existingIds.add(id);
      uniqueMessages.push(msg);
    }
  }

  // Keep recent IDs bounded in SecureStore
  const boundedIds = Array.from(existingIds).slice(-500);
  await SecureStore.setItemAsync(RESTORED_IDS_KEY, JSON.stringify(boundedIds)).catch(() => {});
  if (data.restoredAt) {
    await SecureStore.setItemAsync(LAST_SYNC_KEY, data.restoredAt).catch(() => {});
  }

  onProgress?.(1, 'Restore complete');

  return {
    ...data,
    messages: uniqueMessages,
    skippedDuplicates,
  };
}

export async function syncAcrossDevices(): Promise<{
  serverTime: string;
  syncedCount: number;
  rooms: any[];
  messages: any[];
}> {
  const since = (await SecureStore.getItemAsync(LAST_SYNC_KEY).catch(() => null)) || '';
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  const response = await api.get(`/backup/sync${query}`);
  const data = response.data.data;

  // Deduplicate synced messages by _id
  const seen = new Set<string>();
  const deduped = (data.messages || []).filter((m: any) => {
    const id = String(m._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (data.serverTime) {
    await SecureStore.setItemAsync(LAST_SYNC_KEY, data.serverTime).catch(() => {});
  }

  return {
    ...data,
    messages: deduped,
  };
}

export async function runAutoBackupIfDue(): Promise<void> {
  try {
    const status = await getBackupStatus();
    if (!status.autoBackupEnabled || status.autoBackupFrequency === 'manual') return;

    const intervalMs =
      status.autoBackupFrequency === 'weekly'
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

    const lastTime = status.lastBackupAt ? new Date(status.lastBackupAt).getTime() : 0;
    if (Date.now() - lastTime >= intervalMs) {
      await createBackup();
    }
  } catch {
    // Non-fatal background auto-backup
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatBackupTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
