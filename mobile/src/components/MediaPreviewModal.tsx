import React from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type MediaAttachment = {
  url: string;
  filename?: string;
  fileType?: string;
};

type Props = {
  visible: boolean;
  media: MediaAttachment | null;
  onClose: () => void;
};

export function MediaPreviewModal({ visible, media, onClose }: Props) {
  if (!media) return null;
  const isVideo = Boolean(media.fileType?.startsWith('video/'));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.topBar}>
          <Text style={styles.filename} numberOfLines={1}>
            {media.filename || (isVideo ? 'Video Preview' : 'Image Preview')}
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.centerContent}>
          {isVideo ? (
            <View style={styles.videoCard}>
              <Text style={styles.videoIcon}>🎬</Text>
              <Text style={styles.videoTitle}>{media.filename || 'Video attachment'}</Text>
              <Pressable
                onPress={() => Linking.openURL(media.url).catch(() => {})}
                style={styles.playBtn}
              >
                <Text style={styles.playBtnText}>▶ Open Video</Text>
              </Pressable>
            </View>
          ) : (
            <Image
              source={{ uri: media.url }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.96)',
    justifyContent: 'space-between',
    paddingVertical: 36,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filename: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', flex: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '100%', height: '85%', borderRadius: 12 },
  videoCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 28,
    alignItems: 'center',
    gap: 14,
    width: '88%',
  },
  videoIcon: { fontSize: 44 },
  videoTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  playBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
  },
  playBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
