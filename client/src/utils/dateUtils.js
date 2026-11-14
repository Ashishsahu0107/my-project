/**
 * Format message time (e.g. "11:24 AM")
 */
export const formatMessageTime = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format date divider group (e.g. "Today", "Yesterday", "November 14, 2026")
 */
export const getDateGroupLabel = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - messageDay.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' })
  });
};

/**
 * Format last seen status
 */
export const formatLastSeen = (lastSeenDate, status) => {
  if (status === 'online') return 'Active now';
  if (status === 'away') return 'Away';
  if (status === 'busy') return 'Do not disturb';
  if (!lastSeenDate) return 'Offline';

  const date = new Date(lastSeenDate);
  if (isNaN(date.getTime())) return 'Offline';

  const diffMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (diffMinutes < 1) return 'Just left';
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;

  return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
};
