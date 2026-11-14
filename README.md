# ChatApp • Scalable Real-time Chat Application with Complete Authentication

A full-stack, real-time chat application featuring a robust authentication system built with **React**, **Tailwind CSS**, **Node.js**, **Express**, **MongoDB/Mongoose**, **JWT (Access & Refresh Tokens)**, and **Socket.IO**.

---

## 🚀 Key Features

### 🔐 Complete Authentication & Security
- **User Registration & Login**: Multi-field registration with username, email, password, and custom avatar. Login supports both username or email.
- **JWT Access & Refresh Tokens**:
  - Short-lived Access Token (15 min) for secure API requests.
  - Long-lived Refresh Token (7 days) with token rotation.
  - Automatic silent token refresh via Axios interceptors on the frontend.
- **Bcrypt Password Hashing**: Passwords and one-time verification passcodes are securely hashed with `bcryptjs`.
- **Email OTP Verification**:
  - Secure 6-digit numeric OTP required to activate new accounts.
  - Configurable expiration (default: 10 minutes) and brute-force attempt limits.
  - Supports real SMTP delivery via `nodemailer` and formatted console preview in development.
  - Resend OTP with countdown timer (60s) and rate-limiting.
- **Forgot & Reset Password**:
  - Password reset via 6-digit email OTP.
  - Automatic session revocation of old refresh tokens on password reset.
- **Logout & Session Revocation**: Invalidates refresh tokens on the server, updates user presence to `offline`, and cleans client storage.
- **Protected Routes & Persistent Login**:
  - Session restoration on browser reload via `AuthContext` and `/api/auth/me`.
  - `ProtectedRoute` and `PublicRoute` guards for navigation flow.
- **Form Validation & Robust Error Handling**:
  - Client-side live validation and password strength indicators.
  - Server-side validation middlewares and uniform JSON error responses.

---

## 🛠️ API Endpoints

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
| `POST` | `/api/auth/logout` | Revoke user session & set status to offline (Protected) |
| `GET`  | `/api/auth/me` | Fetch currently authenticated user profile (Protected) |
| `PUT`  | `/api/auth/profile` | Update avatar, bio, and status (Protected) |

### Real-Time Chat & Rooms
| Method | Endpoint | Description |
|---|---|---|
| `GET`  | `/api/rooms` | Fetch user channels and direct conversations |
| `POST` | `/api/rooms` | Create a new channel or direct message thread |
| `GET`  | `/api/messages/room/:roomId` | Fetch messages in a channel or DM |
| `POST` | `/api/messages` | Send message & broadcast via Socket.IO |
| `POST` | `/api/messages/:id/react` | Add/toggle emoji reaction |

---

## ⚙️ Environment Variables

Located in `server/.env` (see `server/.env.example`):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

MONGODB_URI=mongodb://localhost:27017/chat_app
USE_IN_MEMORY_DB=auto

JWT_SECRET=your_jwt_access_secret_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
OTP_EXPIRY_MINUTES=10

# Optional SMTP Configuration
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="ChatApp Security" <no-reply@chatapp.local>
```

---

## 🏃 Running the Application

### Install Dependencies
```bash
npm run install:all
```

### Run Tests
```bash
npm run test:server
```

### Start Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```
