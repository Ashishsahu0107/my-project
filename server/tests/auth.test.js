import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'http';
import { app, server, startServer } from '../server.js';
import { closeDB } from '../config/db.js';

const TEST_PORT = 5001;

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

describe('Authentication & Security Suite', () => {
  let devOtp = null;
  let accessToken = null;
  let refreshToken = null;
  const testUser = {
    username: 'testuser_' + Date.now(),
    email: `test_${Date.now()}@example.com`,
    password: 'SecurePassword123!'
  };

  before(async () => {
    process.env.TEST = 'true';
    await startServer(TEST_PORT);
  });

  after(async () => {
    await closeDB();
    server.close();
  });

  test('Health check endpoint responds with 200', async () => {
    const res = await makeRequest({ path: '/health' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
  });

  test('POST /api/auth/register creates unverified user and sends OTP', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: testUser
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.email, testUser.email);
    assert.equal(res.body.data.isVerified, false);
    assert.ok(res.body.data.devOtp, 'Development OTP should be present');
    devOtp = res.body.data.devOtp;
  });

  test('POST /api/auth/login fails when user is unverified', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        emailOrUsername: testUser.email,
        password: testUser.password
      }
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.requiresVerification, true);
  });

  test('POST /api/auth/verify-otp fails with incorrect OTP', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/verify-otp',
      body: {
        email: testUser.email,
        otp: '000000'
      }
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'error');
  });

  test('POST /api/auth/verify-otp succeeds with correct OTP & issues access + refresh tokens', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/verify-otp',
      body: {
        email: testUser.email,
        otp: devOtp
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
    assert.equal(res.body.data.user.email, testUser.email);
    assert.equal(res.body.data.user.isVerified, true);

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  test('GET /api/auth/me accesses protected profile with valid JWT access token', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.user.email, testUser.email);
  });

  test('GET /api/auth/me rejects request without token with 401', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: '/api/auth/me'
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/auth/login succeeds with correct password for verified user', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        emailOrUsername: testUser.email,
        password: testUser.password
      }
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  test('POST /api/auth/refresh-token rotates tokens using valid refresh token', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/refresh-token',
      body: { refreshToken }
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  test('POST /api/auth/forgot-password dispatches reset OTP', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/forgot-password',
      body: { email: testUser.email }
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.data?.devOtp);
    devOtp = res.body.data.devOtp;
  });

  test('POST /api/auth/reset-password updates password with OTP', async () => {
    const newPassword = 'NewlyChangedPassword99!';
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/reset-password',
      body: {
        email: testUser.email,
        otp: devOtp,
        newPassword
      }
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.accessToken);

    // Verify login with new password
    const loginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        emailOrUsername: testUser.email,
        password: newPassword
      }
    });

    assert.equal(loginRes.status, 200);
    accessToken = loginRes.body.data.accessToken;
  });

  test('POST /api/auth/logout revokes session', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/logout',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
  });
});
