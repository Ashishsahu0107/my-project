import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'http';
import { io as ClientIO } from 'socket.io-client';
import { app, server, startServer } from '../server.js';
import { closeDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import { Message } from '../models/Message.js';

const TEST_PORT = 5002;

const makeRequest = ({ method = 'GET', path, body = null, headers = {} }) => {
  return new Promise((resolve, reject) => {
    const jsonBody = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (jsonBody) {
      reqHeaders['Content-Length'] = Buffer.byteLength(jsonBody);
    }

    const req = request.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (jsonBody) {
      req.write(jsonBody);
    }
    req.end();
  });
};

describe('Real-Time Messaging & Socket.IO Suite', () => {
  let user1, user2;
  let token1, token2;
  let clientSocket1, clientSocket2;
  let testRoom;

  before(async () => {
    process.env.TEST = 'true';
    await startServer(TEST_PORT);

    // Create 2 verified test users
    user1 = await User.create({
      username: 'user_one_' + Date.now(),
      email: `user1_${Date.now()}@example.com`,
      password: 'Password123!',
      isVerified: true,
      status: 'online'
    });

    user2 = await User.create({
      username: 'user_two_' + Date.now(),
      email: `user2_${Date.now()}@example.com`,
      password: 'Password123!',
      isVerified: true,
      status: 'online'
    });

    token1 = user1.generateAccessToken();
    token2 = user2.generateAccessToken();

    // Create test room
    testRoom = await Room.create({
      name: 'realtime-test',
      type: 'channel',
      creator: user1._id,
      members: [user1._id, user2._id]
    });
  });

  after(async () => {
    if (clientSocket1) clientSocket1.disconnect();
    if (clientSocket2) clientSocket2.disconnect();
    await closeDB();
    server.close();
  });

  test('Socket.IO rejects connection without token', (t, done) => {
    const socket = ClientIO(`http://127.0.0.1:${TEST_PORT}`, {
      transports: ['websocket'],
      reconnection: false
    });

    socket.on('connect_error', (err) => {
      assert.match(err.message, /token required|Authentication/i);
      socket.disconnect();
      done();
    });
  });

  test('Socket.IO authenticates users with valid JWT tokens', (t, done) => {
    clientSocket1 = ClientIO(`http://127.0.0.1:${TEST_PORT}`, {
      auth: { token: token1 },
      transports: ['websocket']
    });

    clientSocket2 = ClientIO(`http://127.0.0.1:${TEST_PORT}`, {
      auth: { token: token2 },
      transports: ['websocket']
    });

    let connectedCount = 0;
    const checkBothConnected = () => {
      connectedCount++;
      if (connectedCount === 2) {
        assert.ok(clientSocket1.connected);
        assert.ok(clientSocket2.connected);
        done();
      }
    };

    clientSocket1.on('connect', checkBothConnected);
    clientSocket2.on('connect', checkBothConnected);
  });

  test('Both sockets join test room & communicate in real-time', (t, done) => {
    const roomId = testRoom._id.toString();
    const testContent = 'Hello from Socket 1! 🚀';

    clientSocket1.emit('room:join', roomId);
    clientSocket2.emit('room:join', roomId);

    clientSocket2.once('message:received', (msg) => {
      assert.equal(msg.content, testContent);
      assert.equal(msg.sender.username, user1.username);
      assert.equal(msg.room, roomId);
      assert.equal(msg.status, 'sent');
      done();
    });

    // Send via socket with acknowledgement
    clientSocket1.emit(
      'message:send',
      {
        roomId,
        content: testContent,
        clientTempId: 'temp_123'
      },
      (ack) => {
        assert.equal(ack.status, 'ok');
        assert.equal(ack.data.clientTempId, 'temp_123');
      }
    );
  });

  test('Typing indicators are broadcast to other room participants', (t, done) => {
    const roomId = testRoom._id.toString();

    clientSocket2.once('typing:status', (data) => {
      assert.equal(data.roomId, roomId);
      assert.equal(data.user.username, user1.username);
      assert.equal(data.isTyping, true);
      done();
    });

    clientSocket1.emit('typing:start', { roomId });
  });

  test('Read receipts mark messages as read and broadcast to room', (t, done) => {
    const roomId = testRoom._id.toString();

    clientSocket1.once('message:read_receipt', (data) => {
      assert.equal(data.roomId, roomId);
      assert.equal(data.readerId.toString(), user2._id.toString());
      done();
    });

    clientSocket2.emit('message:read', { roomId });
  });

  test('GET /api/messages/room/:roomId returns paginated MongoDB history', async () => {
    const roomId = testRoom._id.toString();

    // Create 3 additional test messages in MongoDB
    await Message.create({ room: roomId, sender: user1._id, content: 'Historical Message 1' });
    await Message.create({ room: roomId, sender: user2._id, content: 'Historical Message 2' });
    await Message.create({ room: roomId, sender: user1._id, content: 'Historical Message 3' });

    // Request with limit 2
    const res = await makeRequest({
      method: 'GET',
      path: `/api/messages/room/${roomId}?limit=2`,
      headers: {
        Authorization: `Bearer ${token1}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.messages.length, 2);
    assert.equal(res.body.data.hasMore, true);
    assert.ok(res.body.data.nextCursor);

    // Fetch older messages before nextCursor
    const olderRes = await makeRequest({
      method: 'GET',
      path: `/api/messages/room/${roomId}?limit=5&before=${encodeURIComponent(res.body.data.nextCursor)}`,
      headers: {
        Authorization: `Bearer ${token1}`
      }
    });

    assert.equal(olderRes.status, 200);
    assert.ok(olderRes.body.data.messages.length >= 1);
  });

  test('POST /api/messages/room/:roomId/read marks unread messages as read', async () => {
    const roomId = testRoom._id.toString();

    const res = await makeRequest({
      method: 'POST',
      path: `/api/messages/room/${roomId}/read`,
      headers: {
        Authorization: `Bearer ${token1}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.ok(res.body.data.modifiedCount >= 0);
  });
});
