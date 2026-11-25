import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  roomName: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
};

export function ChatActionsModal({
  visible,
  roomName,
  isFavorite,
  isPinned,
  isArchived,
  onClose,
  onToggleFavorite,
  onTogglePin,
  onToggleArchive,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.titleText} numberOfLines={1}>
                {roomName}
              </Text>
            </View>

            <Pressable
              style={styles.row}
              onPress={() => {
                onTogglePin();
                onClose();
              }}
            >
              <Text style={styles.rowText}>
                {isPinned ? '📌  Unpin Chat' : '📌  Pin Chat to Top'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.row}
              onPress={() => {
                onToggleFavorite();
                onClose();
              }}
            >
              <Text style={styles.rowText}>
                {isFavorite ? '☆  Remove from Favorites' : '★  Add to Favorites'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.row, styles.lastRow]}
              onPress={() => {
                onToggleArchive();
                onClose();
              }}
            >
              <Text style={[styles.rowText, !isArchived && styles.warnText]}>
                {isArchived ? '📤  Unarchive Chat' : '🗄️  Archive Chat'}
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  sheet: {
    gap: 10,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  titleRow: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#020617',
  },
  titleText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '800',
  },
  row: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  warnText: {
    color: '#FBBF24',
  },
  cancelBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
});
