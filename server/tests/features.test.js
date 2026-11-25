import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startServer } from '../server.js';
import { User } from '../models/User.js';

let server;
let baseUrl;
let tokenA;
let tokenB;
let userAId;
let userBId;
let roomId;
let messageId;

async function req(path, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) }
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function createVerifiedUser(suffix) {
  const email = `audit_${suffix}_${Date.now()}@example.com`;
  const username = `audit_${suffix}_${Date.now()}`;
  const password = 'Password@123';

  const reg = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password })
  });
  assert.equal(reg.status, 201);
  const otp = reg.body.data.devOtp;

  const verify = await req('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp })
  });
  assert.equal(verify.status, 200);

  return {
    token: verify.body.data.accessToken,
    userId: verify.body.data.user.id,
    username,
    email,
    password
  };
}

describe('Extended Features Audit Suite', () => {
  before(async () => {
    process.env.TEST = 'true';
    process.env.USE_IN_MEMORY_DB = 'true';
    server = await startServer(5003);
    baseUrl = 'http://localhost:5003';

    const a = await createVerifiedUser('a');
    const b = await createVerifiedUser('b');
    tokenA = a.token;
    tokenB = b.token;
    userAId = a.userId;
    userBId = b.userId;

    const roomRes = await req('/api/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ type: 'direct', recipientId: userBId })
    });
    assert.equal(roomRes.status, 201);
    roomId = roomRes.body.data.room._id;

    const msgRes = await req('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ roomId, content: 'Audit keyword hello world' })
    });
    assert.equal(msgRes.status, 201);
    messageId = msgRes.body.data.message._id;
  });

  after(async () => {
    await User.deleteMany({});
    if (server) server.close();
    await mongoose.disconnect();
  });

  it('Messages: react, edit, search, forward, and delete (me/everyone)', async () => {
    const react = await req(`/api/messages/${messageId}/react`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ emoji: '👍' })
    });
    assert.equal(react.status, 200);
    assert.equal(react.body.data.message.reactions.length, 1);

    const edit = await req(`/api/messages/${messageId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ content: 'Audit keyword edited message' })
    });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.data.message.isEdited, true);

    const search = await req('/api/messages/search?q=edited', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(search.status, 200);
    assert.ok(search.body.data.messages.some((m) => m._id === messageId));

    const fwd = await req(`/api/messages/${messageId}/forward`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ targetRoomIds: [roomId] })
    });
    assert.equal(fwd.status, 201);
    assert.equal(fwd.body.data.messages[0].isForwarded, true);

    const delMe = await req(`/api/messages/${messageId}?scope=me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.equal(delMe.status, 200);

    const delAll = await req(`/api/messages/${messageId}?scope=everyone`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(delAll.status, 200);
  });

  it('Rooms: favorite, pin, archive, and filters', async () => {
    const fav = await req(`/api/rooms/${roomId}/favorite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(fav.body.data.isFavorite, true);

    const pin = await req(`/api/rooms/${roomId}/pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(pin.body.data.isPinned, true);

    const arch = await req(`/api/rooms/${roomId}/archive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(arch.body.data.isArchived, true);

    const mainList = await req('/api/rooms?filter=all', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(mainList.body.data.rooms.some((r) => r._id === roomId), false);

    const archList = await req('/api/rooms?filter=archived', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(archList.body.data.rooms.some((r) => r._id === roomId), true);
  });

  it('Calls: history and stats endpoints respond 200', async () => {
    const hist = await req('/api/calls/history', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(hist.status, 200);
    assert.ok(Array.isArray(hist.body.data.calls));

    const stats = await req('/api/calls/stats', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(stats.status, 200);
    assert.equal(typeof stats.body.data.totalCalls, 'number');
  });

  it('Backup & Sync: create, status, restore, and incremental sync', async () => {
    const settings = await req('/api/backup/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ autoBackupEnabled: true, autoBackupFrequency: 'daily' })
    });
    assert.equal(settings.status, 200);
    assert.equal(settings.body.data.autoBackupEnabled, true);

    const created = await req('/api/backup/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(created.status, 200);
    assert.ok(created.body.data.checksum);

    const status = await req('/api/backup/status', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(status.body.data.hasBackup, true);

    const restored = await req('/api/backup/restore', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(restored.status, 200);
    assert.ok(Array.isArray(restored.body.data.rooms));

    const synced = await req('/api/backup/sync', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(synced.status, 200);
    assert.ok(synced.body.data.serverTime);
  });

  it('Profile & App Settings: update profile and sync settings', async () => {
    const prof = await req('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        displayName: 'Audit User A',
        phoneNumber: '+1 555 123 4567',
        profilePhotoVisibility: 'contacts'
      })
    });
    assert.equal(prof.status, 200);
    assert.equal(prof.body.data.user.displayName, 'Audit User A');

    const updSettings = await req('/api/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ theme: 'light', language: 'hi', fontSize: 'large' })
    });
    assert.equal(updSettings.status, 200);
    assert.equal(updSettings.body.data.settings.theme, 'light');
    assert.equal(updSettings.body.data.settings.language, 'hi');
  });

  it('Privacy & Security: 2FA PIN, privacy, block/unblock, and logout-all', async () => {
    const en2fa = await req('/api/security/two-step/enable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ pin: '123456' })
    });
    assert.equal(en2fa.status, 200);

    const ver2fa = await req('/api/security/two-step/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ pin: '123456' })
    });
    assert.equal(ver2fa.status, 200);

    const block = await req(`/api/security/block/${userBId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(block.status, 200);

    // Blocked user cannot send direct message
    const blockedMsg = await req('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ roomId, content: 'Should be blocked' })
    });
    assert.equal(blockedMsg.status, 403);

    const unblock = await req(`/api/security/block/${userBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(unblock.status, 200);

    const logoutAll = await req('/api/security/logout-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(logoutAll.status, 200);

    // Previous tokenA is immediately rejected after logout-all
    const afterLogout = await req('/api/auth/me', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(afterLogout.status, 401);
  });
});
