import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

type RoomItem = {
  _id: string;
  name?: string;
  type: 'channel' | 'direct' | 'group';
};

type Props = {
  visible: boolean;
  rooms: RoomItem[];
  currentRoomId?: string;
  onClose: () => void;
  onConfirm: (targetRoomIds: string[]) => Promise<void>;
};

export function ForwardMessageModal({
  visible,
  rooms,
  currentRoomId,
  onClose,
  onConfirm,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const toggleRoom = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (!selectedIds.length || sending) return;
    setSending(true);
    try {
      await onConfirm(selectedIds);
      setSelectedIds([]);
      onClose();
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    setSelectedIds([]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Forward Message To</Text>
            <Pressable onPress={handleClose}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <FlatList
            data={rooms}
            keyExtractor={(item) => item._id}
            style={styles.list}
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item._id);
              const isCurrent = item._id === currentRoomId;
              return (
                <Pressable
                  onPress={() => toggleRoom(item._id)}
                  style={[styles.roomRow, selected && styles.roomRowSelected]}
                >
                  <View style={styles.roomInfo}>
                    <Text style={styles.roomPrefix}>
                      {item.type === 'direct' ? '@' : '#'}
                    </Text>
                    <Text style={styles.roomName}>
                      {item.name || 'Direct Chat'}
                      {isCurrent ? ' (current)' : ''}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>
              );
            }}
          />

          <Pressable
            onPress={handleSend}
            disabled={!selectedIds.length || sending}
            style={[
              styles.forwardBtn,
              (!selectedIds.length || sending) && styles.forwardBtnDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.forwardBtnText}>
                Forward {selectedIds.length ? `(${selectedIds.length})` : ''}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    maxHeight: '72%',
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 18,
    padding: 4,
  },
  list: {
    maxHeight: 340,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  roomRowSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#1E1B4B',
  },
  roomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roomPrefix: {
    color: '#818CF8',
    fontSize: 15,
    fontWeight: '800',
  },
  roomName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#6366F1',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  forwardBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardBtnDisabled: {
    opacity: 0.45,
  },
  forwardBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
