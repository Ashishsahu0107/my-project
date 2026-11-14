# ChatApp • Scalable Real-time Chat Application

A modern full-stack real-time chat application built with **React**, **Tailwind CSS**, **Node.js**, **Express**, **MongoDB/Mongoose**, **JWT (Access & Refresh Tokens)**, and **Socket.IO**.

---

## 🚀 Key Features

### ⚡ Real-Time Messaging Engine (Socket.IO)
- **Instant Delivery**: Messages sent and received in real-time over authenticated WebSocket connections.
- **One-to-One Private Chat**: Automatic direct conversation creation between users with dedicated headers, avatars, and presence status.
- **Online / Offline Presence**: Live presence indicators (green for online, amber for away, gray for offline) and active socket session tracking.
- **Typing Indicators**: Real-time debounced typing broadcasts with animated bouncing dots.
- **Delivery & Read Receipts**:
  - `pending`: Clock spinner (optimistic UI)
  - `sent`: Single gray tick (✓)
  - `delivered`: Double gray ticks (✓✓)
  - `read`: Double blue ticks (✓✓)
- **Message Timestamps & Date Separators**: Smart timestamp formatting and calendar date dividers ("Today", "Yesterday", "Nov 14, 2026").
- **MongoDB History & Lazy Loading**: Cursor-based infinite scroll-up pagination for historical conversations.
- **Real-Time Notifications & Sound**: In-app floating toast alerts and synthesized Web Audio chime for incoming messages.
- **Optimistic UI**: Immediate UI updates on send with automatic ACK reconciliation and failure retry.

### 🔐 Complete Authentication & Security
- **Registration & Login**: JWT access token (15m) + refresh token (7d) rotation.
- **Bcrypt Hashing**: Passwords and 6-digit OTP codes securely hashed.
- **Email OTP Verification**: Required 6-digit code verification during signup with brute-force protection and resend timer.
- **Forgot & Reset Password**: Secure self-service recovery via OTP.
- **Protected Routes & Persistent Sessions**: Automated session restore on browser refresh.

---

## 📡 Socket.IO Real-Time Events

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `room:join` | Client ➔ Server | `roomId` | Joins a channel or direct chat room |
| `room:leave` | Client ➔ Server | `roomId` | Leaves the room |
| `message:send` | Client ➔ Server | `{ roomId, content, clientTempId }` | Sends message instantly with ACK callback |
| `message:received` | Server ➔ Room | `Message` | Broadcasts new message to all room members |
| `typing:start` | Client ➔ Server | `{ roomId }` | Emits typing state |
| `typing:stop` | Client ➔ Server | `{ roomId }` | Clears typing state |
| `typing:status` | Server ➔ Room | `{ roomId, user, isTyping }` | Broadcasts typing state to peers |
| `message:read` | Client ➔ Server | `{ roomId, messageIds }` | Marks messages as read |
| `message:read_receipt` | Server ➔ Room | `{ roomId, readerId, readAt }` | Updates blue tick status in real-time |
| `message:delivered` | Client ➔ Server | `{ roomId, messageIds }` | Acknowledges receipt delivery |
| `message:delivered_receipt` | Server ➔ Room | `{ roomId, userId, deliveredAt }` | Updates double gray tick status |
| `user:status` | Server ➔ All | `{ userId, status }` | Live presence update (online/offline) |
| `notification:new_message` | Server ➔ User | `{ roomId, roomName, message }` | Direct notification for backgrounded rooms |

---

## 🛠️ REST API Endpoints

### Real-Time Chat & Rooms
| Method | Endpoint | Description |
|---|---|---|
| `GET`  | `/api/rooms` | Fetch user channels and direct conversations |
| `POST` | `/api/rooms` | Create a new channel or 1-on-1 direct conversation |
| `GET`  | `/api/messages/room/:roomId` | Fetch paginated chat history (`limit`, `before` cursor) |
| `POST` | `/api/messages` | Send message via REST (broadcasts to Socket.IO) |
| `POST` | `/api/messages/room/:roomId/read` | Mark all unread messages in room as read |
| `POST` | `/api/messages/:id/react` | Add/toggle emoji reaction |

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user & dispatch 6-digit email OTP |
| `POST` | `/api/auth/verify-otp` | Verify email OTP & issue JWT access + refresh tokens |
| `POST` | `/api/auth/resend-otp` | Request a fresh verification OTP |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT tokens |
| `POST` | `/api/auth/refresh-token` | Rotate tokens using active refresh token |
| `POST` | `/api/auth/forgot-password`| Send 6-digit password reset OTP to email |
| `POST` | `/api/auth/reset-password` | Verify reset OTP & update password |
| `POST` | `/api/auth/logout` | Revoke user session & set status to offline |
| `GET`  | `/api/auth/me` | Fetch currently authenticated user profile |
| `PUT`  | `/api/auth/profile` | Update avatar, bio, and status |

---

## 🏃 Running the Application

```bash
# Run test suite
npm run test:server

# Build production frontend
npm run build

# Start server
npm start
```
