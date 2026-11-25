import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export function ChatSkeleton({
  bgColor = '#020617',
  cardColor = '#0F172A',
}: {
  bgColor?: string;
  cardColor?: string;
}) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const rows = [
    { mine: false, width: '62%' as const },
    { mine: true, width: '54%' as const },
    { mine: false, width: '74%' as const },
    { mine: true, width: '48%' as const },
    { mine: false, width: '68%' as const },
    { mine: true, width: '58%' as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.headerSkeleton}>
        <Animated.View style={[styles.headerBox, { backgroundColor: cardColor, opacity: pulse }]} />
        <Animated.View style={[styles.headerBtn, { backgroundColor: cardColor, opacity: pulse }]} />
      </View>

      <View style={styles.chipsRow}>
        {[1, 2, 3, 4].map((i) => (
          <Animated.View
            key={i}
            style={[styles.chipSkeleton, { backgroundColor: cardColor, opacity: pulse }]}
          />
        ))}
      </View>

      <View style={styles.messages}>
        {rows.map((row, idx) => (
          <View key={idx} style={[styles.row, row.mine && styles.rowMine]}>
            {!row.mine && (
              <Animated.View
                style={[styles.avatar, { backgroundColor: cardColor, opacity: pulse }]}
              />
            )}
            <Animated.View
              style={[
                styles.bubble,
                { width: row.width, backgroundColor: cardColor, opacity: pulse },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 14, gap: 14 },
  headerSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBox: { width: 140, height: 32, borderRadius: 10 },
  headerBtn: { width: 96, height: 32, borderRadius: 10 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chipSkeleton: { width: 78, height: 32, borderRadius: 16 },
  messages: { flex: 1, gap: 14, paddingTop: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowMine: { justifyContent: 'flex-end' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  bubble: { height: 52, borderRadius: 16 },
});
