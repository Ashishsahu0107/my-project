# ChatApp — API Reference

**Base URL:** `http://localhost:5000/api`  
**Content-Type:** `application/json`

## Authentication & Standard Errors

Protected endpoints require a JWT Bearer token:
```http
Authorization: Bearer <accessToken>
```

### Standard Error Response
```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Error description"
}
```

---

## Table of Contents
1. [Health Module](#1-health-module)
2. [Auth Module (`/api/auth`)](#2-auth-module-apiauth)
3. [Users Module (`/api/users`)](#3-users-module-apiusers)
4. [Rooms & Groups Module (`/api/rooms`)](#4-rooms--groups-module-apirooms)
5. [Messages Module (`/api/messages`)](#5-messages-module-apimessages)
6. [Calls Module (`/api/calls`)](#6-calls-module-apicalls)
7. [Backup & Sync Module (`/api/backup`)](#7-backup--sync-module-apibackup)
8. [Privacy & Security Module (`/api/security`)](#8-privacy--security-module-apisecurity)
9. [App Settings Module (`/api/settings`)](#9-app-settings-module-apisettings)
10. [Socket.IO Real-Time Events](#10-socketio-real-time-events)

---

## 1. Health Module

### 1.1 Server Health Check
- **Endpoint:** `GET /health` or `GET /api/health`
- **Auth:** Public

**Response (`200 OK`):**
```json
{
  "status": "healthy",
  "timestamp": "2026-11-26T00:00:00.000Z",
  "uptime": 123.45,
  "env": "development"
}
```

---

## 2. Auth Module (`/api/auth`)

### 2.1 Register User
- **Endpoint:** `POST /api/auth/register`
- **Auth:** Public

**Request:**
```json
{
  "username": "ashishsahu",
  "email": "ashish@example.com",
  "password": "Password@123",
  "avatar": "https://example.com/avatar.png"
}
```
> `avatar` is optional.

**Response (`201 Created`):**
```json
{
  "status": "success",
  "message": "Registration successful! Verification code sent to your email.",
  "data": {
    "userId": "6745a1b2c3d4e5f6a7b8c9d0",
    "email": "ashish@example.com",
    "username": "ashishsahu",
    "isVerified": false,
    "expiresInMinutes": 10
  }
}
```

---

### 2.2 Verify Email OTP
- **Endpoint:** `POST /api/auth/verify-otp`
- **Auth:** Public

**Request:**
```json
{
  "email": "ashish@example.com",
  "otp": "123456"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Email verified successfully! Welcome to ChatApp.",
  "data": {
    "user": {
      "id": "6745a1b2c3d4e5f6a7b8c9d0",
      "username": "ashishsahu",
      "email": "ashish@example.com",
      "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=ashishsahu",
      "status": "online",
      "statusMessage": "",
      "isVerified": true,
      "createdAt": "2026-11-26T00:00:00.000Z"
    },
    "accessToken": "<jwt_access_token>",
    "refreshToken": "<jwt_refresh_token>",
    "token": "<jwt_access_token>"
  }
}
```

---

### 2.3 Resend Verification OTP
- **Endpoint:** `POST /api/auth/resend-otp`
- **Auth:** Public

**Request:**
```json
{
  "email": "ashish@example.com"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "A fresh verification code has been dispatched to your email.",
  "data": {
    "email": "ashish@example.com",
    "expiresInMinutes": 10
  }
}
```

---

### 2.4 Login
- **Endpoint:** `POST /api/auth/login`
- **Auth:** Public

**Request:**
```json
{
  "emailOrUsername": "ashishsahu",
  "password": "Password@123"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Logged in successfully",
  "data": {
    "user": {
      "id": "6745a1b2c3d4e5f6a7b8c9d0",
      "username": "ashishsahu",
      "email": "ashish@example.com",
      "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=ashishsahu",
      "status": "online",
      "statusMessage": "",
      "bio": "",
      "isVerified": true,
      "createdAt": "2026-11-26T00:00:00.000Z"
    },
    "accessToken": "<jwt_access_token>",
    "refreshToken": "<jwt_refresh_token>",
    "token": "<jwt_access_token>"
  }
}
```

---

### 2.5 Refresh Access Token
- **Endpoint:** `POST /api/auth/refresh-token`
- **Auth:** Public (requires valid `refreshToken` in body or `x-refresh-token` header)

**Request:**
```json
{
  "refreshToken": "<jwt_refresh_token>"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "accessToken": "<new_jwt_access_token>",
    "refreshToken": "<new_jwt_refresh_token>",
    "token": "<new_jwt_access_token>"
  }
}
```

---

### 2.6 Forgot Password
- **Endpoint:** `POST /api/auth/forgot-password`
- **Auth:** Public

**Request:**
```json
{
  "email": "ashish@example.com"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Password reset code has been sent to your email.",
  "data": {
    "email": "ashish@example.com",
    "expiresInMinutes": 10
  }
}
```

---

### 2.7 Reset Password
- **Endpoint:** `POST /api/auth/reset-password`
- **Auth:** Public

**Request:**
```json
{
  "email": "ashish@example.com",
  "otp": "123456",
  "newPassword": "NewPassword@123"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Password has been reset successfully. You are now logged in.",
  "data": {
    "user": {
      "id": "6745a1b2c3d4e5f6a7b8c9d0",
      "username": "ashishsahu",
      "email": "ashish@example.com",
      "avatar": "...",
      "status": "online",
      "statusMessage": "",
      "isVerified": true,
      "createdAt": "2026-11-26T00:00:00.000Z"
    },
    "accessToken": "<jwt_access_token>",
    "refreshToken": "<jwt_refresh_token>",
    "token": "<jwt_access_token>"
  }
}
```

---

### 2.8 Logout
- **Endpoint:** `POST /api/auth/logout`
- **Auth:** Bearer Token

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

### 2.9 Get Current User Profile
- **Endpoint:** `GET /api/auth/me`
- **Auth:** Bearer Token

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "_id": "6745a1b2c3d4e5f6a7b8c9d0",
      "username": "ashishsahu",
      "email": "ashish@example.com",
      "avatar": "...",
      "bio": "",
      "status": "online",
      "statusMessage": "",
      "isVerified": true
    }
  }
}
```

---

### 2.10 Update Profile
- **Endpoint:** `PUT /api/auth/profile`
- **Auth:** Bearer Token

**Request:**
```json
{
  "username": "ashishsahu",
  "displayName": "Ashish Sahu",
  "phoneNumber": "+1 555 012 3456",
  "avatar": "https://example.com/new-avatar.png",
  "bio": "Building real-time apps",
  "status": "online",
  "statusMessage": "Available",
  "profilePhotoVisibility": "everyone"
}
```
> All fields are optional. `avatar` accepts an image URL or base64 data URI. `profilePhotoVisibility` accepts `'everyone' | 'contacts' | 'nobody'`.

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "_id": "6745a1b2c3d4e5f6a7b8c9d0",
      "username": "ashishsahu",
      "displayName": "Ashish Sahu",
      "phoneNumber": "+1 555 012 3456",
      "avatar": "https://example.com/new-avatar.png",
      "bio": "Building real-time apps",
      "status": "online",
      "statusMessage": "Available"
    }
  }
}
```

---

### 2.10b Request Email Change *(New)*
- **Endpoint:** `POST /api/auth/email/request-change`
- **Auth:** Bearer Token

**Request:**
```json
{
  "newEmail": "newemail@example.com"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Verification code sent to your new email address",
  "data": {
    "newEmail": "newemail@example.com",
    "expiresInMinutes": 10
  }
}
```

---

### 2.10c Verify Email Change *(New)*
- **Endpoint:** `POST /api/auth/email/verify-change`
- **Auth:** Bearer Token

**Request:**
```json
{
  "otp": "123456"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Email address updated and verified",
  "data": {
    "user": {
      "_id": "6745a1b2c3d4e5f6a7b8c9d0",
      "email": "newemail@example.com"
    }
  }
}
```

---

### 2.11 Register Push Token
- **Endpoint:** `POST /api/auth/push-token`
- **Auth:** Bearer Token

**Request:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "android",
  "deviceId": "pixel-7"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Push token registered"
}
```

---

### 2.12 Remove Push Token
- **Endpoint:** `DELETE /api/auth/push-token`
- **Auth:** Bearer Token

**Request:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Push token removed"
}
```

---

## 3. Users Module (`/api/users`)

All endpoints require Bearer Token authentication.

### 3.1 List / Search Users
- **Endpoint:** `GET /api/users`
- **Query Params:** `search` (optional, matches `username` or `email`)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "results": 1,
  "data": {
    "users": [
      {
        "_id": "6745a1b2c3d4e5f6a7b8c9d1",
        "username": "rohit",
        "email": "rohit@example.com",
        "avatar": "...",
        "status": "online",
        "statusMessage": "",
        "lastSeen": "2026-11-26T00:00:00.000Z",
        "bio": ""
      }
    ]
  }
}
```

---

### 3.2 Get User by ID
- **Endpoint:** `GET /api/users/:id`
- **Path Params:** `id` (User ID)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "_id": "6745a1b2c3d4e5f6a7b8c9d1",
      "username": "rohit",
      "email": "rohit@example.com",
      "avatar": "...",
      "status": "online",
      "statusMessage": "",
      "lastSeen": "2026-11-26T00:00:00.000Z",
      "bio": "",
      "createdAt": "2026-11-25T12:00:00.000Z"
    }
  }
}
```

---

## 4. Rooms & Groups Module (`/api/rooms`)

All endpoints require Bearer Token authentication.

### 4.1 Get User Rooms & Public Channels
- **Endpoint:** `GET /api/rooms`
- **Query Params:**
  - `filter` (optional): `all` (default) | `unread` | `groups` | `favorites` | `archived` *(non-archived views automatically exclude archived chats; pinned chats are sorted first)*
  - `search` (optional): Filter rooms by channel/group name or direct member username

**Response (`200 OK`):**
```json
{
  "status": "success",
  "results": 1,
  "data": {
    "rooms": [
      {
        "_id": "6745b1b2c3d4e5f6a7b8c901",
        "name": "general",
        "type": "channel",
        "isPrivate": false,
        "unreadCount": 2,
        "isFavorite": true,
        "isPinned": true,
        "isArchived": false,
        "members": [
          {
            "_id": "6745a1b2c3d4e5f6a7b8c9d0",
            "username": "ashishsahu",
            "status": "online"
          }
        ],
        "lastMessage": null,
        "updatedAt": "2026-11-26T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 4.2 Get Room by ID
- **Endpoint:** `GET /api/rooms/:id`
- **Path Params:** `id` (Room ID)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "room": {
      "_id": "6745b1b2c3d4e5f6a7b8c901",
      "name": "general",
      "type": "channel",
      "members": [],
      "creator": {
        "_id": "6745a1b2c3d4e5f6a7b8c9d0",
        "username": "ashishsahu",
        "email": "ashish@example.com",
        "avatar": "..."
      }
    }
  }
}
```

---

### 4.3 Create Channel or Direct Conversation
- **Endpoint:** `POST /api/rooms`

**Request (Direct 1-on-1):**
```json
{
  "type": "direct",
  "recipientId": "6745a1b2c3d4e5f6a7b8c9d1"
}
```

**Request (Channel):**
```json
{
  "type": "channel",
  "name": "engineering",
  "description": "Engineering discussions"
}
```

**Response (`201 Created` / `200 OK` if direct room exists):**
```json
{
  "status": "success",
  "data": {
    "room": {
      "_id": "6745b1b2c3d4e5f6a7b8c902",
      "type": "direct",
      "creator": "6745a1b2c3d4e5f6a7b8c9d0",
      "members": [
        { "_id": "6745a1b2c3d4e5f6a7b8c9d0", "username": "ashishsahu" },
        { "_id": "6745a1b2c3d4e5f6a7b8c9d1", "username": "rohit" }
      ]
    }
  }
}
```

---

### 4.4 Join a Room
- **Endpoint:** `POST /api/rooms/:id/join`
- **Path Params:** `id` (Room ID)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "room": {
      "_id": "6745b1b2c3d4e5f6a7b8c901",
      "name": "general",
      "members": []
    }
  }
}
```

---

### 4.5 Create Group
- **Endpoint:** `POST /api/rooms/group`

**Request:**
```json
{
  "name": "Project Team",
  "description": "Core team chat",
  "avatar": "",
  "memberIds": ["6745a1b2c3d4e5f6a7b8c9d1"]
}
```

**Response (`201 Created`):**
```json
{
  "status": "success",
  "data": {
    "room": {
      "_id": "6745b1b2c3d4e5f6a7b8c903",
      "name": "Project Team",
      "type": "group",
      "description": "Core team chat",
      "members": [],
      "admins": []
    }
  }
}
```

---

### 4.6 Update Group
- **Endpoint:** `PUT /api/rooms/group/:id`
- **Path Params:** `id` (Group ID)

**Request:**
```json
{
  "name": "Project Team v2",
  "description": "Updated description",
  "avatar": "https://example.com/group.png"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "room": {
      "_id": "6745b1b2c3d4e5f6a7b8c903",
      "name": "Project Team v2",
      "type": "group"
    }
  }
}
```

---

### 4.7 Add Group Members
- **Endpoint:** `POST /api/rooms/group/:id/members`
- **Path Params:** `id` (Group ID)

**Request:**
```json
{
  "memberIds": ["6745a1b2c3d4e5f6a7b8c9d2"]
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "room": {
      "_id": "6745b1b2c3d4e5f6a7b8c903",
      "members": []
    }
  }
}
```

---

### 4.8 Remove Group Member
- **Endpoint:** `DELETE /api/rooms/group/:id/members/:memberId`
- **Path Params:** `id` (Group ID), `memberId` (User ID)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "room": {
      "_id": "6745b1b2c3d4e5f6a7b8c903",
      "members": [],
      "admins": []
    }
  }
}
```

---

### 4.9 Set / Unset Group Admin
- **Endpoint:** `POST /api/rooms/group/:id/admin`
- **Path Params:** `id` (Group ID, creator only)

**Request:**
```json
{
  "memberId": "6745a1b2c3d4e5f6a7b8c9d1",
  "makeAdmin": true
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "room": {
      "_id": "6745b1b2c3d4e5f6a7b8c903",
      "members": [],
      "admins": []
    }
  }
}
```

---

### 4.10 Leave Group
- **Endpoint:** `POST /api/rooms/group/:id/leave`
- **Path Params:** `id` (Group ID)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Left group successfully"
}
```

---

### 4.11 Delete Group
- **Endpoint:** `DELETE /api/rooms/group/:id`
- **Path Params:** `id` (Group ID, creator only)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Group deleted successfully"
}
```

---

### 4.12 Toggle Favorite Room *(New)*
- **Endpoint:** `POST /api/rooms/:id/favorite`
- **Path Params:** `id` (Room ID)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "roomId": "6745b1b2c3d4e5f6a7b8c901",
    "isFavorite": true
  }
}
```

---

### 4.13 Toggle Pin Room *(New)*
- **Endpoint:** `POST /api/rooms/:id/pin`
- **Path Params:** `id` (Room ID)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "roomId": "6745b1b2c3d4e5f6a7b8c901",
    "isPinned": true
  }
}
```

---

### 4.14 Toggle Archive Room *(New)*
- **Endpoint:** `POST /api/rooms/:id/archive`
- **Path Params:** `id` (Room ID)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "roomId": "6745b1b2c3d4e5f6a7b8c901",
    "isArchived": true
  }
}
```

---

## 5. Messages Module (`/api/messages`)

All endpoints require Bearer Token authentication.

### 5.1 Get Messages by Room
- **Endpoint:** `GET /api/messages/room/:roomId`
- **Path Params:** `roomId`
- **Query Params:** `limit` (default `25`, max `100`), `before` (ISO date cursor), `around` (optional Message ID to jump to a specific message with surrounding context)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "results": 1,
  "data": {
    "messages": [
      {
        "_id": "6745c1b2c3d4e5f6a7b8c001",
        "room": "6745b1b2c3d4e5f6a7b8c901",
        "sender": {
          "_id": "6745a1b2c3d4e5f6a7b8c9d0",
          "username": "ashishsahu",
          "avatar": "..."
        },
        "content": "Hello!",
        "status": "delivered",
        "createdAt": "2026-11-26T00:00:00.000Z"
      }
    ],
    "nextCursor": "2026-11-26T00:00:00.000Z",
    "hasMore": false
  }
}
```

---

### 5.2 Send Message
- **Endpoint:** `POST /api/messages`

**Request:**
```json
{
  "roomId": "6745b1b2c3d4e5f6a7b8c901",
  "content": "Hello everyone!",
  "clientTempId": "temp-1732560000000",
  "attachments": [],
  "replyTo": "6745c1b2c3d4e5f6a7b8c000",
  "isForwarded": false,
  "forwardedFrom": null
}
```
> `clientTempId`, `attachments`, `replyTo`, `isForwarded`, and `forwardedFrom` are optional.

**Response (`201 Created`):**
```json
{
  "status": "success",
  "data": {
    "message": {
      "_id": "6745c1b2c3d4e5f6a7b8c001",
      "room": "6745b1b2c3d4e5f6a7b8c901",
      "sender": {
        "_id": "6745a1b2c3d4e5f6a7b8c9d0",
        "username": "ashishsahu"
      },
      "content": "Hello everyone!",
      "status": "sent",
      "replyTo": {
        "_id": "6745c1b2c3d4e5f6a7b8c000",
        "content": "Original message",
        "sender": { "_id": "...", "username": "rohit" }
      },
      "isForwarded": false,
      "createdAt": "2026-11-26T00:00:00.000Z"
    },
    "clientTempId": "temp-1732560000000"
  }
}
```

---

### 5.3 Mark Room Messages as Read
- **Endpoint:** `POST /api/messages/room/:roomId/read`
- **Path Params:** `roomId`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Messages marked as read",
  "data": {
    "modifiedCount": 3
  }
}
```

---

### 5.4 React to Message
- **Endpoint:** `POST /api/messages/:id/react`
- **Path Params:** `id` (Message ID)

**Request:**
```json
{
  "emoji": "👍"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "message": {
      "_id": "6745c1b2c3d4e5f6a7b8c001",
      "reactions": [
        {
          "emoji": "👍",
          "user": "6745a1b2c3d4e5f6a7b8c9d0"
        }
      ]
    }
  }
}
```

---

### 5.5 Edit Message
- **Endpoint:** `PATCH /api/messages/:id`
- **Path Params:** `id` (Message ID, sender only)

**Request:**
```json
{
  "content": "Updated message text"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "message": {
      "_id": "6745c1b2c3d4e5f6a7b8c001",
      "content": "Updated message text",
      "isEdited": true
    }
  }
}
```

---

### 5.6 Delete Message (For Me or Everyone)
- **Endpoint:** `DELETE /api/messages/:id`
- **Path Params:** `id` (Message ID)
- **Query / Body Params:** `scope` — `'me'` (any room member) or `'everyone'` (default, sender only)

**Response (`200 OK` — `scope=me`):**
```json
{
  "status": "success",
  "message": "Message deleted for you",
  "data": {
    "messageId": "6745c1b2c3d4e5f6a7b8c001",
    "scope": "me"
  }
}
```

**Response (`200 OK` — `scope=everyone`):**
```json
{
  "status": "success",
  "message": "Message deleted for everyone",
  "data": {
    "messageId": "6745c1b2c3d4e5f6a7b8c001",
    "scope": "everyone"
  }
}
```

---

### 5.7 Forward Message *(New)*
- **Endpoint:** `POST /api/messages/:id/forward`
- **Path Params:** `id` (Original Message ID)

**Request:**
```json
{
  "targetRoomIds": [
    "6745b1b2c3d4e5f6a7b8c902",
    "6745b1b2c3d4e5f6a7b8c903"
  ]
}
```

**Response (`201 Created`):**
```json
{
  "status": "success",
  "results": 2,
  "data": {
    "messages": [
      {
        "_id": "6745c1b2c3d4e5f6a7b8c099",
        "room": "6745b1b2c3d4e5f6a7b8c902",
        "content": "Original message text",
        "isForwarded": true,
        "forwardedFrom": {
          "_id": "6745a1b2c3d4e5f6a7b8c9d0",
          "username": "ashishsahu"
        },
        "status": "sent",
        "createdAt": "2026-11-26T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 5.8 Search Messages *(New)*
- **Endpoint:** `GET /api/messages/search`
- **Query Params:**
  - `q` (required): Keyword to search in message content
  - `roomId` (optional): Scope search to a single room
  - `page` (optional, default `1`)
  - `limit` (optional, default `20`, max `50`)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "results": 1,
  "data": {
    "messages": [
      {
        "_id": "6745c1b2c3d4e5f6a7b8c001",
        "room": {
          "_id": "6745b1b2c3d4e5f6a7b8c901",
          "name": "general",
          "type": "channel"
        },
        "sender": {
          "_id": "6745a1b2c3d4e5f6a7b8c9d0",
          "username": "ashishsahu",
          "avatar": "..."
        },
        "content": "Meeting at 5pm",
        "createdAt": "2026-11-26T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasMore": false
    }
  }
}
```

---

## 6. Calls Module (`/api/calls`)

All endpoints require Bearer Token authentication.

### 6.1 Get Call History
- **Endpoint:** `GET /api/calls/history`
- **Query Params:** `page` (default `1`), `limit` (default `20`, max `100`)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "results": 1,
  "data": {
    "calls": [
      {
        "_id": "6745d1b2c3d4e5f6a7b8c101",
        "callId": "call_1732560000000_abc1234",
        "caller": {
          "_id": "6745a1b2c3d4e5f6a7b8c9d0",
          "username": "ashishsahu",
          "avatar": "..."
        },
        "callee": {
          "_id": "6745a1b2c3d4e5f6a7b8c9d1",
          "username": "rohit",
          "avatar": "..."
        },
        "type": "video",
        "status": "ended",
        "startedAt": "2026-11-26T00:00:00.000Z",
        "answeredAt": "2026-11-26T00:00:05.000Z",
        "endedAt": "2026-11-26T00:02:05.000Z",
        "duration": 120,
        "endReason": "completed",
        "createdAt": "2026-11-26T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasMore": false
    }
  }
}
```

---

### 6.2 Get Call Statistics
- **Endpoint:** `GET /api/calls/stats`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "totalCalls": 12,
    "missedCalls": 2,
    "totalDuration": 1840
  }
}
```

---

## 7. Backup & Sync Module (`/api/backup`) *(New)*

All endpoints require Bearer Token authentication. Backups are encrypted at rest in MongoDB using AES-256-GCM and verified with SHA-256 checksums.

### 7.1 Get Backup Status & Settings
- **Endpoint:** `GET /api/backup/status`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "hasBackup": true,
    "status": "completed",
    "autoBackupEnabled": true,
    "autoBackupFrequency": "daily",
    "lastBackupAt": "2026-11-26T00:00:00.000Z",
    "lastSyncAt": "2026-11-26T00:00:00.000Z",
    "stats": {
      "roomCount": 4,
      "messageCount": 120,
      "mediaCount": 8,
      "sizeBytes": 42180
    },
    "lastError": ""
  }
}
```

---

### 7.2 Update Backup Settings
- **Endpoint:** `PUT /api/backup/settings`

**Request:**
```json
{
  "autoBackupEnabled": true,
  "autoBackupFrequency": "daily"
}
```
> `autoBackupFrequency`: `'daily' | 'weekly' | 'manual'`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "autoBackupEnabled": true,
    "autoBackupFrequency": "daily"
  }
}
```

---

### 7.3 Create Encrypted Backup
- **Endpoint:** `POST /api/backup/create`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Backup completed securely",
  "data": {
    "lastBackupAt": "2026-11-26T00:00:00.000Z",
    "stats": {
      "roomCount": 4,
      "messageCount": 120,
      "mediaCount": 8,
      "sizeBytes": 42180
    },
    "checksum": "<sha256_hex>",
    "status": "completed"
  }
}
```

---

### 7.4 Restore Backup
- **Endpoint:** `POST /api/backup/restore`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Backup restored successfully",
  "data": {
    "lastBackupAt": "2026-11-26T00:00:00.000Z",
    "restoredAt": "2026-11-26T00:10:00.000Z",
    "stats": {
      "roomCount": 4,
      "messageCount": 120,
      "mediaCount": 8
    },
    "rooms": [],
    "messages": [],
    "media": []
  }
}
```

---

### 7.5 Incremental Multi-Device Sync
- **Endpoint:** `GET /api/backup/sync`
- **Query Params:** `since` (optional ISO8601 timestamp)

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "serverTime": "2026-11-26T00:10:00.000Z",
    "rooms": [],
    "messages": [],
    "syncedCount": 5
  }
}
```

---

## 8. Privacy & Security Module (`/api/security`) *(New)*

All endpoints require Bearer Token authentication.

### 8.1 Get Security & Privacy Overview
- **Endpoint:** `GET /api/security/overview`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "twoStepEnabled": false,
    "privacySettings": {
      "lastSeenVisibility": "everyone",
      "onlineStatusVisibility": "everyone",
      "profilePhotoVisibility": "everyone",
      "statusVisibility": "everyone"
    },
    "blockedUsers": [],
    "activeSessions": [],
    "currentSessionId": "<uuid>"
  }
}
```

---

### 8.2 Enable Two-Step Verification PIN
- **Endpoint:** `POST /api/security/two-step/enable`

**Request:**
```json
{
  "pin": "123456"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Two-step verification enabled",
  "data": {
    "twoStepEnabled": true
  }
}
```

---

### 8.3 Disable Two-Step Verification PIN
- **Endpoint:** `POST /api/security/two-step/disable`

**Request:**
```json
{
  "pin": "123456"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Two-step verification disabled",
  "data": {
    "twoStepEnabled": false
  }
}
```

---

### 8.4 Verify Two-Step PIN
- **Endpoint:** `POST /api/security/two-step/verify`

**Request:**
```json
{
  "pin": "123456"
}
```

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "PIN verified"
}
```

---

### 8.5 Update Privacy Visibility Settings
- **Endpoint:** `PUT /api/security/privacy`

**Request:**
```json
{
  "lastSeenVisibility": "nobody",
  "onlineStatusVisibility": "contacts",
  "profilePhotoVisibility": "everyone",
  "statusVisibility": "nobody"
}
```
> Values: `'everyone' | 'contacts' | 'nobody'`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "privacySettings": {
      "lastSeenVisibility": "nobody",
      "onlineStatusVisibility": "contacts",
      "profilePhotoVisibility": "everyone",
      "statusVisibility": "nobody"
    }
  }
}
```

---

### 8.6 Block / Unblock User
- **Block:** `POST /api/security/block/:userId`
- **Unblock:** `DELETE /api/security/block/:userId`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "@rohit has been blocked",
  "data": {
    "blockedUsers": [
      { "_id": "6745a1b2c3d4e5f6a7b8c9d1", "username": "rohit", "avatar": "..." }
    ]
  }
}
```

---

### 8.7 Manage Active Sessions & Logout All Devices
- **List Sessions:** `GET /api/security/sessions`
- **Revoke Session:** `DELETE /api/security/sessions/:sessionId`
- **Logout All Devices:** `POST /api/security/logout-all`

**Response (`200 OK` — `logout-all`):**
```json
{
  "status": "success",
  "message": "Logged out from all devices securely"
}
```

---

## 9. App Settings Module (`/api/settings`) *(New)*

All endpoints require Bearer Token authentication.

### 9.1 Get App Settings
- **Endpoint:** `GET /api/settings`

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "settings": {
      "theme": "dark",
      "language": "en",
      "notificationsEnabled": true,
      "soundEnabled": true,
      "vibrationEnabled": true,
      "chatWallpaper": "default",
      "fontSize": "medium",
      "autoDownloadMedia": true
    }
  }
}
```

---

### 9.2 Update App Settings
- **Endpoint:** `PUT /api/settings`

**Request:**
```json
{
  "theme": "light",
  "language": "hi",
  "fontSize": "large",
  "chatWallpaper": "ocean",
  "notificationsEnabled": true,
  "soundEnabled": true,
  "vibrationEnabled": true,
  "autoDownloadMedia": true
}
```
> All fields are optional.

**Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "settings": {
      "theme": "light",
      "language": "hi",
      "notificationsEnabled": true,
      "soundEnabled": true,
      "vibrationEnabled": true,
      "chatWallpaper": "ocean",
      "fontSize": "large",
      "autoDownloadMedia": true
    }
  }
}
```

---

## 10. Socket.IO Real-Time Events

**Connection:**
```js
const socket = io('http://localhost:5000', {
  auth: { token: accessToken },
  transports: ['websocket', 'polling']
});
```

### 7.1 Presence & Chat Events

| Event | Direction | Request / Emit Payload | Response / Broadcast Payload |
|---|---|---|---|
| `users:online_list` | Server ➔ Client | — | `["userId1", "userId2"]` |
| `user:status` | Server ➔ All | — | `{ "userId": "...", "status": "online \| offline", "lastSeen": "ISO8601" }` |
| `room:join` | Client ➔ Server | `"roomId"` | — |
| `room:leave` | Client ➔ Server | `"roomId"` | — |
| `message:send` | Client ➔ Server | `{ "roomId": "...", "content": "...", "clientTempId": "...", "attachments": [], "replyTo": null, "isForwarded": false, "forwardedFrom": null }` | ACK: `{ "status": "ok", "data": Message }` |
| `message:received` | Server ➔ Room | — | `Message` object (with `clientTempId`, `replyTo`, `forwardedFrom`) |
| `message:updated` | Server ➔ Room | — | Updated `Message` object (after edit or emoji reaction) |
| `message:deleted` | Server ➔ Room | — | `{ "messageId": "...", "roomId": "..." }` (deleted for everyone) |
| `message:deleted_for_me` | Server ➔ User | — | `{ "messageId": "...", "roomId": "..." }` (deleted for self) |
| `room:preference_updated` | Server ➔ User | — | `{ "roomId": "...", "isFavorite?": true, "isPinned?": true, "isArchived?": false }` |
| `backup:completed` | Server ➔ User | — | `{ "lastBackupAt": "ISO8601", "stats": { roomCount, messageCount, mediaCount, sizeBytes } }` |
| `user:privacy_updated` | Server ➔ All | — | `{ "userId": "...", "privacySettings": { ... } }` |
| `user:profile_updated` | Server ➔ All | — | `{ "userId": "...", "user": { ... } }` |
| `user:settings_updated` | Server ➔ User | — | `{ "settings": { theme, language, fontSize, chatWallpaper, ... } }` |
| `auth:session_revoked` | Server ➔ User | — | `{ "sessionId": "..." }` |
| `auth:force_logout` | Server ➔ User | — | `{ "reason": "Logged out from all devices" }` |
| `notification:new_message` | Server ➔ User | — | `{ "roomId": "...", "roomName": "...", "roomType": "...", "message": Message }` |
| `typing:start` | Client ➔ Server | `{ "roomId": "..." }` | — |
| `typing:stop` | Client ➔ Server | `{ "roomId": "..." }` | — |
| `typing:status` | Server ➔ Room | — | `{ "roomId": "...", "user": { "id": "...", "username": "..." }, "isTyping": true }` |
| `message:read` | Client ➔ Server | `{ "roomId": "...", "messageIds": ["..."] }` | — |
| `message:read_receipt` | Server ➔ Room | — | `{ "roomId": "...", "readerId": "...", "messageIds": ["..."], "readAt": "ISO8601" }` |
| `message:delivered` | Client ➔ Server | `{ "roomId": "...", "messageIds": ["..."] }` | — |
| `message:delivered_receipt` | Server ➔ Room | — | `{ "roomId": "...", "userId": "...", "messageIds": ["..."], "deliveredAt": "ISO8601" }` |

---

### 7.2 Audio / Video Call Signaling Events

| Event | Direction | Payload |
|---|---|---|
| `call:initiate` | Client ➔ Server | `{ "calleeId": "...", "type": "audio \| video", "callId": "..." }` |
| `call:incoming` | Server ➔ Callee | `{ "callId": "...", "callerId": "...", "callerName": "...", "callerAvatar": "...", "type": "audio \| video" }` |
| `call:ringing` | Server ➔ Caller | `{ "callId": "..." }` |
| `call:busy` | Server ➔ Caller | `{ "callId": "...", "reason": "User is already in a call" }` |
| `call:failed` | Server ➔ Caller | `{ "callId": "...", "reason": "user_offline \| server_error" }` |
| `call:accept` | Client ➔ Server | `{ "callId": "..." }` |
| `call:accepted` | Server ➔ Caller | `{ "callId": "..." }` |
| `call:reject` | Client ➔ Server | `{ "callId": "...", "reason": "rejected \| busy" }` |
| `call:rejected` | Server ➔ Caller | `{ "callId": "...", "reason": "rejected \| busy" }` |
| `call:end` | Client ➔ Server | `{ "callId": "...", "duration": 120 }` |
| `call:ended` | Server ➔ Peer | `{ "callId": "...", "reason": "network_error" }` *(reason included on disconnect)* |
| `call:cancel` | Client ➔ Server | `{ "callId": "..." }` |
| `call:cancelled` | Server ➔ Callee | `{ "callId": "..." }` |
| `call:no_answer` | Client ➔ Server | `{ "callId": "..." }` |
| `call:missed` | Server ➔ Callee | `{ "callId": "...", "callerName": "..." }` |
| `call:webrtc_offer` | Client ➔ Server ➔ Peer | Emit: `{ "callId": "...", "offer": RTCSessionDescriptionInit, "targetUserId": "..." }`<br>Receive: `{ "callId": "...", "offer": ..., "fromUserId": "..." }` |
| `call:webrtc_answer` | Client ➔ Server ➔ Peer | Emit: `{ "callId": "...", "answer": RTCSessionDescriptionInit, "targetUserId": "..." }`<br>Receive: `{ "callId": "...", "answer": ..., "fromUserId": "..." }` |
| `call:webrtc_ice` | Client ➔ Server ➔ Peer | Emit: `{ "callId": "...", "candidate": RTCIceCandidateInit, "targetUserId": "..." }`<br>Receive: `{ "callId": "...", "candidate": ..., "fromUserId": "..." }` |
