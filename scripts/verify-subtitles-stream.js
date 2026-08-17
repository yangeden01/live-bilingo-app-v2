#!/usr/bin/env node
/**
 * scripts/verify-subtitles-stream.js
 * Automated verification simulator for live radio STT and bilingual subtitle streaming.
 * Strict Quality Gate:
 *  1. Backend server health check (/api/version)
 *  2. Clear old subtitle history (/api/clear-subtitles-history)
 *  3. Connect & notify station stream (/api/notify-station-playing)
 *  4. Verify REAL-TIME STREAMING: Must capture at least 2 NEW live speech subtitles
 *     generated AFTER test start time with valid English and Traditional Chinese.
 *  5. If no new subtitles update within timeout, test FAILS and release is ABORTED.
 */

import http from 'http';

const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;
const TIMEOUT_MS = 25000;
const REQUIRED_NEW_SUBTITLES = 2;

console.log('====================================================');
console.log('🎙️ [Simulator] Starting Live Subtitles Stream Verification Gate...');
console.log('====================================================');

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: SERVER_HOST,
        port: SERVER_PORT,
        path,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, data, headers: res.headers }));
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${path} timed out`));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runSimulator() {
  const testStartTime = Date.now();
  const capturedNewSubtitles = new Map();

  try {
    // Step 1: Verify Server Health
    console.log('\n[Step 1/4] Checking Backend Server Health...');
    const healthRes = await makeRequest('/api/version');
    if (healthRes.statusCode !== 200) {
      throw new Error(`Server health check failed with status code ${healthRes.statusCode}`);
    }
    console.log('✅ Backend server is healthy:', healthRes.data);

    // Step 2: Clear Subtitles History to prevent false positives from stale cache
    console.log('\n[Step 2/4] Resetting subtitle cache to ensure fresh real-time verification...');
    await makeRequest('/api/clear-subtitles-history', { method: 'POST' });

    // Step 3: Trigger Radio Stream STT Engine
    console.log('\n[Step 3/4] Activating Live Radio STT Engine (NHPR News Stream)...');
    const notifyRes = await makeRequest('/api/notify-station-playing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://nhpr.streamguys1.com/nhpr',
        name: 'NHPR Public Radio News',
      }),
    });
    console.log('✅ Radio STT session activated:', notifyRes.data);

    // Step 4: Real-time Live Subtitle Verification Listener
    console.log('\n[Step 4/4] Listening for NEW real-time radio speech subtitles...');
    console.log(`   Criteria: Must capture >= ${REQUIRED_NEW_SUBTITLES} newly generated radio speech subtitles with EN & ZH.`);

    // Connect SSE listener
    const sseReq = http.request(
      {
        hostname: SERVER_HOST,
        port: SERVER_PORT,
        path: '/api/live-subtitles-stream',
        headers: { Accept: 'text/event-stream' },
      },
      (res) => {
        res.on('data', (chunk) => {
          const text = chunk.toString();
          if (text.includes('data:')) {
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const payload = JSON.parse(line.slice(5).trim());
                  // Check if it's a genuine radio speech subtitle created during this test
                  if (
                    payload.id &&
                    payload.id.startsWith('sub-') &&
                    payload.createdAt &&
                    payload.createdAt >= testStartTime - 1000 &&
                    payload.english &&
                    payload.english.length > 3 &&
                    payload.traditionalChinese
                  ) {
                    if (!capturedNewSubtitles.has(payload.id)) {
                      capturedNewSubtitles.set(payload.id, payload);
                      console.log(`\n   📡 [NEW Live Subtitle #${capturedNewSubtitles.size}]`);
                      console.log(`      ID: ${payload.id} (${new Date(payload.createdAt).toLocaleTimeString()})`);
                      console.log(`      EN: "${payload.english}"`);
                      console.log(`      ZH: "${payload.traditionalChinese}"`);
                    }
                  }
                } catch (e) {}
              }
            }
          }
        });
      }
    );
    sseReq.on('error', () => {});
    sseReq.end();

    // Polling backup loop
    while (Date.now() - testStartTime < TIMEOUT_MS) {
      if (capturedNewSubtitles.size >= REQUIRED_NEW_SUBTITLES) {
        break;
      }

      try {
        const pollRes = await makeRequest(`/api/live-subtitles?since=${testStartTime - 1000}`);
        if (pollRes.statusCode === 200) {
          const parsed = JSON.parse(pollRes.data);
          if (parsed.subtitles && Array.isArray(parsed.subtitles)) {
            for (const sub of parsed.subtitles) {
              if (
                sub.id &&
                sub.id.startsWith('sub-') &&
                sub.createdAt &&
                sub.createdAt >= testStartTime - 1000 &&
                sub.english &&
                sub.english.length > 3 &&
                sub.traditionalChinese
              ) {
                if (!capturedNewSubtitles.has(sub.id)) {
                  capturedNewSubtitles.set(sub.id, sub);
                  console.log(`\n   🔄 [Polling Captured Live Subtitle #${capturedNewSubtitles.size}]`);
                  console.log(`      ID: ${sub.id} (${new Date(sub.createdAt).toLocaleTimeString()})`);
                  console.log(`      EN: "${sub.english}"`);
                  console.log(`      ZH: "${sub.traditionalChinese}"`);
                }
              }
            }
          }
        }
      } catch (e) {}

      if (capturedNewSubtitles.size >= REQUIRED_NEW_SUBTITLES) {
        break;
      }

      console.log(`   [Waiting...] Captured ${capturedNewSubtitles.size}/${REQUIRED_NEW_SUBTITLES} new subtitles. Stream running (${Math.round((Date.now() - testStartTime) / 1000)}s)...`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    try { sseReq.destroy(); } catch (e) {}

    if (capturedNewSubtitles.size < REQUIRED_NEW_SUBTITLES) {
      throw new Error(
        `QUALITY GATE FAILED: Only received ${capturedNewSubtitles.size}/${REQUIRED_NEW_SUBTITLES} new subtitles in ${TIMEOUT_MS / 1000}s. Subtitles are not actively updating!`
      );
    }

    console.log('\n====================================================');
    console.log(`🎉 [PASS] Live Subtitles Stream Simulation Verified 100% OK!`);
    console.log(`   - Verified ${capturedNewSubtitles.size} NEW live speech subtitles generated during test.`);
    console.log(`   - Real-time STT: ACTIVE & UPDATING`);
    console.log(`   - Bilingual Translation: REAL-TIME SYNCED`);
    console.log('====================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ [FAIL] Live Subtitles Verification Failed:', error.message);
    console.error('⛔ Release Quality Gate Blocked: Deployment will NOT proceed until subtitles update reliably.');
    console.log('====================================================\n');
    process.exit(1);
  }
}

runSimulator();
