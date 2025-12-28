import axios from 'axios';

const apiBase = process.env.OPEN_DOMAINS_API_BASE || 'https://beta.open-domains.net/api';
const deviceStartPath = process.env.OPEN_DOMAINS_DEVICE_START_PATH || '/device-auth';
const devicePollPath = process.env.OPEN_DOMAINS_DEVICE_POLL_PATH || '/device-auth/poll';
const enableMock = process.env.OPEN_DOMAINS_MOCK_DEVICE_AUTH === 'true';
const normalizedStartPath = deviceStartPath.replace(/^\//, '');
const normalizedPollPath = devicePollPath.replace(/^\//, '');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const api = axios.create({
  baseURL: apiBase,
  headers: { 'content-type': 'application/json' },
});

export async function startDeviceAuth() {
  if (enableMock) {
    return {
      device_code: 'mock-device-code',
      user_code: 'MOCK1234',
      verification_uri: 'https://example.com/device',
      verification_uri_complete: 'https://example.com/device?user_code=MOCK1234',
      expires_in: 600,
      interval: 5,
      mock: true,
    };
  }

  try {
    const { data } = await api.post(normalizedStartPath);
    return data;
  } catch (error) {
    const status = error.response?.status;
    const payload = error.response?.data;
    const message =
      payload?.error || payload?.message || error.message || 'Device auth start failed.';
    throw new Error(`Device auth start failed (${status ?? 'request error'}): ${message}`);
  }
}

export async function pollForDeviceKey(deviceCode, { interval, expiresIn } = {}) {
  const pollIntervalMs = Math.max((interval ?? 5) * 1000, 1000);
  const expiresAt = Date.now() + (expiresIn ?? 600) * 1000;
  let wait = pollIntervalMs;

  if (enableMock) {
    await sleep(500);
    return 'ok_mock_key';
  }

  while (Date.now() < expiresAt) {
    await sleep(wait);

    try {
      const response = await api.post(normalizedPollPath, { device_code: deviceCode });
      const payload = response.data || {};

      if (response.status === 200 && payload?.key) {
        return payload.key;
      }

      if (response.status === 202) {
        continue;
      }

      const description =
        payload?.error || payload?.message || `Polling failed (${response.status}).`;
      throw new Error(description);
    } catch (error) {
      const status = error.response?.status;
      const payload = error.response?.data || {};
      const description =
        payload?.error || payload?.message || error.message || `Polling failed (${status}).`;

      if (status === 202) {
        continue;
      }

      throw new Error(description);
    }
  }

  throw new Error('Device authorization expired before approval.');
}
