import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

type Props = {
  text: string;
  query: string;
  style?: TextStyle;
  highlightStyle?: TextStyle;
  numberOfLines?: number;
};

export function HighlightedText({
  text,
  query,
  style,
  highlightStyle,
  numberOfLines,
}: Props) {
  const trimmed = query.trim();
  if (!trimmed) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, idx) => {
        const isMatch = part.toLowerCase() === trimmed.toLowerCase();
        return isMatch ? (
          <Text key={idx} style={[styles.highlight, highlightStyle]}>
            {part}
          </Text>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  highlight: {
    backgroundColor: 'rgba(250, 204, 21, 0.28)',
    color: '#FDE047',
    fontWeight: '800',
  },
});
