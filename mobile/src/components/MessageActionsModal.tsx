import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { ChatMessage } from '../services/messageService';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

type Props = {
  visible: boolean;
  message: ChatMessage | null;
  isMine: boolean;
  currentUserId: string;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
};

export function MessageActionsModal({
  visible,
  message,
  isMine,
  currentUserId,
  onClose,
  onReact,
  onReply,
  onCopy,
  onForward,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}: Props) {
  if (!message) return null;

  const isDeleted = Boolean(message.isDeleted);
  const myReactions = new Set(
    (message.reactions || [])
      .filter((r) => String(r.user) === String(currentUserId))
      .map((r) => r.emoji)
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {!isDeleted && (
            <View style={styles.emojiBar}>
              {QUICK_EMOJIS.map((emoji) => {
                const active = myReactions.has(emoji);
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      onReact(emoji);
                      onClose();
                    }}
                    style={[styles.emojiBtn, active && styles.emojiBtnActive]}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.actionsCard}>
            {!isDeleted && (
              <>
                <ActionRow label="↩️  Reply" onPress={() => { onReply(); onClose(); }} />
                <ActionRow label="📋  Copy Text" onPress={() => { onCopy(); onClose(); }} />
                <ActionRow label="↪️  Forward" onPress={() => { onForward(); onClose(); }} />
                {isMine && (
                  <ActionRow label="✏️  Edit Message" onPress={() => { onEdit(); onClose(); }} />
                )}
              </>
            )}

            <ActionRow
              label="🗑️  Delete for Me"
              danger
              onPress={() => { onDeleteForMe(); onClose(); }}
            />

            {isMine && !isDeleted && (
              <ActionRow
                label="🗑️  Delete for Everyone"
                danger
                onPress={() => { onDeleteForEveryone(); onClose(); }}
              />
            )}
          </View>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  label,
  danger,
  onPress,
}: {
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <Text style={[styles.actionLabel, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
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
  emojiBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  emojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnActive: {
    backgroundColor: '#312E81',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  emojiText: {
    fontSize: 22,
  },
  actionsCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  actionRow: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  actionLabel: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  dangerText: {
    color: '#F87171',
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
