import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getApiErrorMessage } from '../src/api/client';
import { useSocket } from '../src/context/SocketContext';
import {
  BackupFrequency,
  BackupStatus,
  createBackup,
  formatBackupTime,
  formatBytes,
  getBackupStatus,
  restoreBackup,
  syncAcrossDevices,
  updateBackupSettings,
} from '../src/services/backupService';

export default function BackupScreen() {
  const router = useRouter();
  const { socket } = useSocket();

  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmRestoreVisible, setConfirmRestoreVisible] = useState(false);

  const loadStatus = async () => {
    setError('');
    try {
      const data = await getBackupStatus();
      setStatus(data);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not load backup status'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onBackupCompleted = ({
      lastBackupAt,
      stats,
    }: {
      lastBackupAt: string;
      stats: BackupStatus['stats'];
    }) => {
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              hasBackup: true,
              lastBackupAt,
              lastSyncAt: lastBackupAt,
              stats,
            }
          : prev
      );
    };
    socket.on('backup:completed', onBackupCompleted);
    return () => {
      socket.off('backup:completed', onBackupCompleted);
    };
  }, [socket]);

  const handleCreateBackup = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccessMsg('');
    setProgress(0.1);
    setProgressLabel('Preparing backup...');
    try {
      const res = await createBackup((p, label) => {
        setProgress(p);
        setProgressLabel(label);
      });
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              hasBackup: true,
              status: 'completed',
              lastBackupAt: res.lastBackupAt,
              lastSyncAt: res.lastBackupAt,
              stats: res.stats,
            }
          : prev
      );
      setSuccessMsg(
        `Backup saved (${res.stats.messageCount} messages, ${res.stats.roomCount} chats).`
      );
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Backup failed. Check your connection and retry.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreConfirmed = async () => {
    setConfirmRestoreVisible(false);
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccessMsg('');
    setProgress(0.1);
    setProgressLabel('Starting restore...');
    try {
      const res = await restoreBackup((p, label) => {
        setProgress(p);
        setProgressLabel(label);
      });
      setStatus((prev) => (prev ? { ...prev, lastSyncAt: res.restoredAt } : prev));
      setSuccessMsg(
        `Restored ${res.stats.messageCount} messages across ${res.stats.roomCount} chats (${res.skippedDuplicates} duplicates prevented).`
      );
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Restore failed. Check your connection and retry.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccessMsg('');
    setProgress(0.4);
    setProgressLabel('Syncing across devices...');
    try {
      const res = await syncAcrossDevices();
      setProgress(1);
      setProgressLabel('Sync complete');
      setStatus((prev) => (prev ? { ...prev, lastSyncAt: res.serverTime } : prev));
      setSuccessMsg(
        `Synced ${res.syncedCount} updated message${res.syncedCount === 1 ? '' : 's'} across ${res.rooms.length} chats.`
      );
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Device sync failed. Please retry.'));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAuto = async (enabled: boolean) => {
    setError('');
    setStatus((prev) => (prev ? { ...prev, autoBackupEnabled: enabled } : prev));
    try {
      await updateBackupSettings({ autoBackupEnabled: enabled });
    } catch (err: any) {
      setStatus((prev) => (prev ? { ...prev, autoBackupEnabled: !enabled } : prev));
      setError(getApiErrorMessage(err, 'Could not update auto-backup setting'));
    }
  };

  const handleFrequencyChange = async (freq: BackupFrequency) => {
    setError('');
    const prevFreq = status?.autoBackupFrequency || 'daily';
    setStatus((prev) => (prev ? { ...prev, autoBackupFrequency: freq } : prev));
    try {
      await updateBackupSettings({ autoBackupFrequency: freq });
    } catch (err: any) {
      setStatus((prev) => (prev ? { ...prev, autoBackupFrequency: prevFreq } : prev));
      setError(getApiErrorMessage(err, 'Could not update backup frequency'));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Backup & Sync</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {successMsg ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Encrypted Cloud Backup</Text>
          <Text style={styles.metaText}>
            Last Backup: {formatBackupTime(status?.lastBackupAt || null)}
          </Text>
          <Text style={styles.metaText}>
            Last Device Sync: {formatBackupTime(status?.lastSyncAt || null)}
          </Text>

          <View style={styles.statsRow}>
            <StatBox label="Chats" value={String(status?.stats.roomCount || 0)} />
            <StatBox label="Messages" value={String(status?.stats.messageCount || 0)} />
            <StatBox label="Media" value={String(status?.stats.mediaCount || 0)} />
            <StatBox label="Size" value={formatBytes(status?.stats.sizeBytes || 0)} />
          </View>

          {busy || progress > 0 ? (
            <View style={styles.progressBox}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={styles.progressLabel}>
                {progressLabel} ({Math.round(progress * 100)}%)
              </Text>
            </View>
          ) : null}

          <View style={styles.btnRow}>
            <Pressable
              onPress={handleCreateBackup}
              disabled={busy}
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
            >
              <Text style={styles.primaryBtnText}>Backup Now</Text>
            </Pressable>
            <Pressable
              onPress={handleSyncNow}
              disabled={busy}
              style={[styles.secondaryBtn, busy && styles.btnDisabled]}
            >
              <Text style={styles.secondaryBtnText}>Sync Devices</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Automatic Backup</Text>
              <Text style={styles.subText}>
                Automatically back up encrypted chats when online
              </Text>
            </View>
            <Switch
              value={Boolean(status?.autoBackupEnabled)}
              onValueChange={handleToggleAuto}
              trackColor={{ false: '#334155', true: '#4F46E5' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <Text style={styles.freqLabel}>Backup Frequency</Text>
          <View style={styles.freqRow}>
            {(['daily', 'weekly', 'manual'] as BackupFrequency[]).map((freq) => {
              const active = status?.autoBackupFrequency === freq;
              return (
                <Pressable
                  key={freq}
                  onPress={() => handleFrequencyChange(freq)}
                  style={[styles.freqChip, active && styles.freqChipActive]}
                >
                  <Text style={[styles.freqText, active && styles.freqTextActive]}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Restore Chat History</Text>
          <Text style={styles.subText}>
            Restore conversations, messages, media metadata, and chat preferences after login or
            reinstall. Duplicate messages are automatically skipped.
          </Text>
          <Pressable
            onPress={() => setConfirmRestoreVisible(true)}
            disabled={busy || !status?.hasBackup}
            style={[
              styles.restoreBtn,
              (busy || !status?.hasBackup) && styles.btnDisabled,
            ]}
          >
            <Text style={styles.restoreBtnText}>
              {status?.hasBackup ? 'Restore Latest Backup' : 'No Backup Available'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={confirmRestoreVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmRestoreVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Restore</Text>
            <Text style={styles.modalBody}>
              Restore backup from {formatBackupTime(status?.lastBackupAt || null)}?{'\n\n'}•{' '}
              {status?.stats.roomCount || 0} conversations{'\n'}•{' '}
              {status?.stats.messageCount || 0} messages{'\n'}•{' '}
              {status?.stats.mediaCount || 0} media items{'\n\n'}
              Existing messages on this device will not be duplicated.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmRestoreVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleRestoreConfirmed} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>Confirm Restore</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backText: { color: '#818CF8', fontWeight: '700', fontSize: 14 },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    gap: 10,
  },
  cardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  metaText: { color: '#94A3B8', fontSize: 13 },
  subText: { color: '#94A3B8', fontSize: 13, lineHeight: 19 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statBox: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { color: '#818CF8', fontSize: 15, fontWeight: '800' },
  statLabel: { color: '#64748B', fontSize: 11, marginTop: 2 },
  progressBox: { gap: 6, marginTop: 4 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#6366F1' },
  progressLabel: { color: '#CBD5E1', fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#E2E8F0', fontWeight: '700', fontSize: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  freqLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginTop: 4 },
  freqRow: { flexDirection: 'row', gap: 8 },
  freqChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  freqChipActive: { backgroundColor: '#1E1B4B', borderColor: '#6366F1' },
  freqText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  freqTextActive: { color: '#E0E7FF' },
  restoreBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#065F46',
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  restoreBtnText: { color: '#ECFDF5', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.45 },
  errorBanner: {
    backgroundColor: '#450A0A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  errorText: { color: '#FCA5A5', fontSize: 13 },
  successBanner: {
    backgroundColor: '#064E3B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  successText: { color: '#A7F3D0', fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    gap: 12,
  },
  modalTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  modalBody: { color: '#CBD5E1', fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { color: '#CBD5E1', fontWeight: '700' },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: { color: '#022C22', fontWeight: '800' },
});
