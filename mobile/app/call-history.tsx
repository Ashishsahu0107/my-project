import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { CallRecord, formatCallDuration, getCallHistory } from '../src/services/callHistoryService';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function statusIcon(status: CallRecord['status']): string {
  if (status === 'ended') return '✅';
  if (status === 'missed') return '❌';
  if (status === 'rejected' || status === 'busy') return '🚫';
  if (status === 'failed') return '⚠️';
  return '📵';
}

function statusColor(status: CallRecord['status']): string {
  if (status === 'ended') return '#F8FAFC';
  if (status === 'missed' || status === 'failed') return '#F87171';
  if (status === 'rejected' || status === 'busy') return '#64748B';
  return '#94A3B8';
}

export default function CallHistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const fetchCalls = useCallback(async (p: number, append = false) => {
    try {
      if (p === 1) setLoading(true); else setLoadingMore(true);
      const result = await getCallHistory(p, 20);
      setCalls((prev) => append ? [...prev, ...result.calls] : result.calls);
      setTotal(result.total);
      setPage(result.page);
    } catch {
      setError('Could not load call history');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls(1);
  }, [fetchCalls]);

  const loadMore = () => {
    if (loadingMore || calls.length >= total) return;
    fetchCalls(page + 1, true);
  };

  const renderItem = ({ item }: { item: CallRecord }) => {
    const isCaller = item.caller._id === user?.id;
    const other = isCaller ? item.callee : item.caller;
    const initial = (other.username?.[0] || '?').toUpperCase();
    const color = statusColor(item.status);

    return (
      <View style={styles.row}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={[styles.name, { color }]}>{other.username}</Text>
          <Text style={styles.meta}>
            {isCaller ? 'Outgoing' : 'Incoming'} · {relativeTime(item.createdAt)}
          </Text>
          {item.status === 'ended' && item.duration > 0 && (
            <Text style={styles.duration}>{formatCallDuration(item.duration)}</Text>
          )}
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.typeIcon}>{item.type === 'video' ? '📹' : '📞'}</Text>
          <Text style={styles.statusIcon}>{statusIcon(item.status)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Call History</Text>
        <View style={styles.backBtn} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6366F1" size="large" />
        </View>
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={calls.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📵</Text>
              <Text style={styles.emptyText}>No call history yet</Text>
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#6366F1" style={{ marginVertical: 16 }} /> : <></>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: { width: 72 },
  backText: { color: '#818CF8', fontSize: 14, fontWeight: '700' },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  list: { paddingVertical: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#475569', fontSize: 16, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#A5B4FC', fontWeight: '800', fontSize: 18 },
  rowInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  meta: { color: '#64748B', fontSize: 12 },
  duration: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: 'center', gap: 4 },
  typeIcon: { fontSize: 18 },
  statusIcon: { fontSize: 14 },
  errorBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#450A0A',
  },
  errorText: { color: '#FCA5A5', fontSize: 12 },
});
