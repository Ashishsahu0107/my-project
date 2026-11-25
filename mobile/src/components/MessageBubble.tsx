import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChatMessage } from '../services/messageService';
import { MediaAttachment } from './MediaPreviewModal';

type ExtendedMessage = ChatMessage & {
  attachments?: MediaAttachment[];
};

type GroupedReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

function groupReactions(
  reactions: ChatMessage['reactions'] = [],
  currentUserId: string
): GroupedReaction[] {
  const map = new Map<string, GroupedReaction>();
  for (const r of reactions) {
    const existing = map.get(r.emoji) || { emoji: r.emoji, count: 0, reactedByMe: false };
    existing.count += 1;
    if (String(r.user) === String(currentUserId)) {
      existing.reactedByMe = true;
    }
    map.set(r.emoji, existing);
  }
  return Array.from(map.values());
}

type Props = {
  item: ExtendedMessage;
  mine: boolean;
  currentUserId: string;
  isHighlighted: boolean;
  maxBubbleWidth: number;
  messageFontSize: number;
  otherBubbleColor: string;
  otherTextColor: string;
  onLongPress: (msg: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onPreviewMedia: (media: MediaAttachment) => void;
};

export const MessageBubble = React.memo(function MessageBubble({
  item,
  mine,
  currentUserId,
  isHighlighted,
  maxBubbleWidth,
  messageFontSize,
  otherBubbleColor,
  otherTextColor,
  onLongPress,
  onReact,
  onPreviewMedia,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const groupedReactions = useMemo(
    () => groupReactions(item.reactions, currentUserId),
    [item.reactions, currentUserId]
  );

  const mediaAttachments = useMemo(
    () =>
      (item.attachments || []).filter(
        (att) => att.fileType?.startsWith('image/') || att.fileType?.startsWith('video/')
      ),
    [item.attachments]
  );

  return (
    <Animated.View
      style={[
        styles.messageRow,
        mine ? styles.mineRow : null,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {!mine && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.sender?.username?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
      )}

      <View style={[styles.bubbleWrapper, { maxWidth: maxBubbleWidth }, mine ? styles.mineWrapper : null]}>
        <Pressable
          onLongPress={() => onLongPress(item)}
          delayLongPress={250}
          style={[
            styles.bubble,
            mine
              ? styles.mineBubble
              : [styles.otherBubble, { backgroundColor: otherBubbleColor }],
            item.isDeleted && styles.deletedBubble,
            isHighlighted && styles.highlightedBubble,
          ]}
        >
          {!mine && <Text style={styles.sender}>@{item.sender?.username}</Text>}

          {item.isForwarded && !item.isDeleted ? (
            <Text style={styles.forwardedLabel}>↪ Forwarded</Text>
          ) : null}

          {item.replyTo && !item.isDeleted ? (
            <View style={styles.replyQuote}>
              <Text style={styles.replyQuoteSender}>
                @{item.replyTo.sender?.username || 'user'}
              </Text>
              <Text style={styles.replyQuoteText} numberOfLines={2}>
                {item.replyTo.isDeleted ? 'This message was deleted' : item.replyTo.content}
              </Text>
            </View>
          ) : null}

          {mediaAttachments.length > 0 && !item.isDeleted ? (
            <View style={styles.mediaList}>
              {mediaAttachments.map((att, idx) => {
                const isVideo = Boolean(att.fileType?.startsWith('video/'));
                return (
                  <Pressable
                    key={`${att.url}-${idx}`}
                    onPress={() => onPreviewMedia(att)}
                    style={styles.mediaThumbWrap}
                  >
                    {isVideo ? (
                      <View style={styles.videoThumb}>
                        <Text style={styles.videoPlayIcon}>▶</Text>
                        <Text style={styles.videoThumbLabel} numberOfLines={1}>
                          {att.filename || 'Video'}
                        </Text>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: att.url }}
                        style={styles.imageThumb}
                        resizeMode="cover"
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Text
            style={[
              styles.messageText,
              { fontSize: messageFontSize, color: mine ? '#F8FAFC' : otherTextColor },
              item.isDeleted && styles.deletedMessageText,
            ]}
          >
            {item.content}
          </Text>

          {item.isEdited && !item.isDeleted ? (
            <Text style={styles.editedLabel}>edited</Text>
          ) : null}
        </Pressable>

        {groupedReactions.length > 0 && !item.isDeleted ? (
          <View style={[styles.reactionsRow, mine && styles.reactionsRowMine]}>
            {groupedReactions.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => onReact(item._id, r.emoji)}
                style={[
                  styles.reactionPill,
                  r.reactedByMe && styles.reactionPillActive,
                ]}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                {r.count > 1 ? <Text style={styles.reactionCount}>{r.count}</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  mineRow: { justifyContent: 'flex-end' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#CBD5E1', fontWeight: '800' },
  bubbleWrapper: { alignItems: 'flex-start' },
  mineWrapper: { alignItems: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  mineBubble: { backgroundColor: '#4F46E5', borderBottomRightRadius: 4 },
  otherBubble: {
    borderWidth: 1,
    borderColor: '#1E293B',
    borderBottomLeftRadius: 4,
  },
  deletedBubble: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  highlightedBubble: { borderWidth: 2, borderColor: '#FACC15' },
  sender: { color: '#818CF8', fontSize: 10, fontWeight: '700', marginBottom: 3 },
  forwardedLabel: {
    color: '#CBD5E1',
    fontSize: 10,
    fontStyle: 'italic',
    opacity: 0.8,
    marginBottom: 4,
  },
  replyQuote: {
    borderLeftWidth: 2,
    borderLeftColor: '#A5B4FC',
    paddingLeft: 8,
    paddingVertical: 3,
    marginBottom: 6,
    backgroundColor: 'rgba(2, 6, 23, 0.25)',
    borderRadius: 6,
  },
  replyQuoteSender: { color: '#C7D2FE', fontSize: 10, fontWeight: '700' },
  replyQuoteText: { color: '#E2E8F0', fontSize: 12, opacity: 0.85 },
  mediaList: { gap: 6, marginBottom: 6 },
  mediaThumbWrap: { borderRadius: 10, overflow: 'hidden' },
  imageThumb: { width: 190, height: 140, borderRadius: 10, backgroundColor: '#1E293B' },
  videoThumb: {
    width: 190,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 4,
  },
  videoPlayIcon: { color: '#818CF8', fontSize: 22 },
  videoThumbLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  messageText: { fontSize: 14 },
  deletedMessageText: { color: '#64748B', fontStyle: 'italic' },
  editedLabel: {
    color: '#CBD5E1',
    fontSize: 10,
    opacity: 0.75,
    alignSelf: 'flex-end',
    marginTop: 3,
  },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionsRowMine: { justifyContent: 'flex-end' },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  reactionPillActive: { backgroundColor: '#312E81', borderColor: '#6366F1' },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
});
