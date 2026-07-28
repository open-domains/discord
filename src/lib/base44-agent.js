import { createClient } from '@base44/sdk';

const appId = process.env.BASE44_APP_ID || '69b6e91dbe1cdaa155ba939d';
const agentName = process.env.BASE44_AGENT_NAME;
const serverUrl = process.env.BASE44_SERVER_URL || 'https://base44.app';
const apiKey = process.env.BASE44_API_KEY || process.env.BASE44_AGENT_API_KEY || '0c695cc91dea47bc9cfeaaca3830f3cc';

export function getBase44Client() {
  if (!appId) {
    throw new Error('Base44 app integration is not configured. Set BASE44_APP_ID first.');
  }

  if (!agentName) {
    throw new Error('Base44 agent integration is not configured. Set BASE44_AGENT_NAME first.');
  }

  return createClient({
    appId,
    serverUrl,
    headers: {
      api_key: apiKey,
    },
  });
}

export function getAgentName() {
  return agentName;
}

export function formatAgentResponse(payload) {
  if (typeof payload === 'string') return payload;

  if (payload && typeof payload === 'object') {
    return payload.message || payload.result || payload.output || payload.reply || JSON.stringify(payload);
  }

  return '';
}
