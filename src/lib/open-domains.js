import axios from 'axios';

const apiBase = process.env.OPEN_DOMAINS_API_BASE || 'https://api.open-domains.net';
const deviceAuthPath = process.env.OPEN_DOMAINS_DEVICE_AUTH_PATH || '/deviceAuth';
const publicApiPath = process.env.OPEN_DOMAINS_PUBLIC_API_PATH || '/';
const enableMock = process.env.OPEN_DOMAINS_MOCK_DEVICE_AUTH === 'true';
const normalizedDeviceAuthPath = deviceAuthPath.replace(/^\//, '');
const normalizedPublicApiPath = publicApiPath.replace(/^\//, '');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const api = axios.create({
  baseURL: apiBase,
  headers: { 'content-type': 'application/json' },
});

export class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}

function getErrorMessage(error, fallback) {
  const payload = error.response?.data;
  return payload?.error || payload?.message || error.message || fallback;
}

export async function startDeviceAuth(tokenName = 'OpenDomains Discord Bot') {
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
    const { data } = await api.post(normalizedDeviceAuthPath, {
      action: 'request_code',
      token_name: tokenName,
    });
    return data;
  } catch (error) {
    const status = error.response?.status;
    const message = getErrorMessage(error, 'Device auth start failed.');
    throw new Error(`Device auth start failed (${status ?? 'request error'}): ${message}`);
  }
}

export async function pollForDeviceKey(deviceCode, { interval, expiresIn } = {}) {
  const pollIntervalMs = Math.max((interval ?? 2) * 1000, 1000);
  const expiresAt = Date.now() + (expiresIn ?? 600) * 1000;
  let wait = pollIntervalMs;

  if (enableMock) {
    await sleep(500);
    return 'ok_mock_key';
  }

  while (Date.now() < expiresAt) {
    await sleep(wait);

    try {
      const response = await api.post(normalizedDeviceAuthPath, {
        action: 'poll',
        device_code: deviceCode,
      });
      const payload = response.data || {};

      if (response.status === 200 && payload.status === 'approved' && payload?.api_key) {
        return payload.api_key;
      }

      if (payload.status === 'pending' || response.status === 202) {
        continue;
      }

      if (payload.status === 'denied') {
        throw new Error('Device authorization was denied.');
      }

      if (payload.status === 'expired') {
        throw new Error('Device authorization expired before approval.');
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

export async function getMe(apiKey) {
  if (!apiKey) {
    throw new Error('An API key is required.');
  }

  try {
    const { data } = await api.get(normalizedPublicApiPath, {
      params: { action: 'me' },
      headers: authHeaders(apiKey),
    });
    return data;
  } catch (error) {
    const status = error.response?.status;
    const message = getErrorMessage(error, 'Unable to fetch account.');

    if (status === 401) {
      throw new UnauthorizedError(message);
    }

    throw new Error(`Account lookup failed (${status ?? 'request error'}): ${message}`);
  }
}

export async function checkSubdomain(subdomain) {
  try {
    const { data } = await api.get(normalizedPublicApiPath, {
      params: { action: 'check', subdomain },
    });
    return data;
  } catch (error) {
    const status = error.response?.status;
    const message = getErrorMessage(error, 'Unable to check availability.');
    throw new Error(`Availability check failed (${status ?? 'request error'}): ${message}`);
  }
}

export async function listRecords(domain) {
  try {
    const { data } = await api.get(normalizedPublicApiPath, {
      params: { action: 'records', domain },
    });
    return data?.records ?? [];
  } catch (error) {
    const status = error.response?.status;
    const message = getErrorMessage(error, 'Unable to fetch records.');
    throw new Error(`Record lookup failed (${status ?? 'request error'}): ${message}`);
  }
}

export async function submitSubdomainRequest(apiKey, request) {
  if (!apiKey) {
    throw new Error('An API key is required to submit requests.');
  }

  try {
    const { data } = await api.post(
      normalizedPublicApiPath,
      {
        action: 'submit',
        ...request,
      },
      {
        headers: authHeaders(apiKey),
      }
    );
    return data;
  } catch (error) {
    const status = error.response?.status;
    const message = getErrorMessage(error, 'Unable to submit request.');

    if (status === 401) {
      throw new UnauthorizedError(message);
    }

    throw new Error(`Subdomain request failed (${status ?? 'request error'}): ${message}`);
  }
}
