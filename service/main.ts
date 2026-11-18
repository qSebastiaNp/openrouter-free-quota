import http from 'node:http';
import { readQuotaProviderRequest } from '@openchamber/sdk';

const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';

type FreeDailyRequests = {
  used: number;
  limit: number;
  remaining: number;
};

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export async function readFreeQuota(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; used: number; limit: number; remaining: number; resetAt: number } | { ok: false; error: string }> {
  let response: Response;
  try {
    response = await fetchImpl(OPENROUTER_KEY_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    return { ok: false, error: 'Could not reach OpenRouter. Check your connection and try again.' };
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'OpenRouter rejected the saved API key. Check your OpenRouter credentials in OpenCode.' };
    }
    return { ok: false, error: `OpenRouter could not provide quota usage (HTTP ${response.status}). Try again later.` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: 'OpenRouter returned an unreadable quota response. Try again later.' };
  }

  const entry = (payload as { data?: { free_model_daily_requests?: Partial<FreeDailyRequests> } } | null)
    ?.data?.free_model_daily_requests;
  if (!entry || !isCount(entry.used) || !isCount(entry.limit) || !isCount(entry.remaining)) {
    return { ok: false, error: 'OpenRouter did not include complete free-model daily quota values. No usage values are available.' };
  }

  const now = new Date();
  const resetAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return { ok: true, used: entry.used, limit: entry.limit, remaining: entry.remaining, resetAt };
}

export function createServiceServer(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const serviceToken = env.OPENCHAMBER_SERVICE_TOKEN;
  return http.createServer(async (req, res) => {
    if (!serviceToken || req.headers.authorization !== `Bearer ${serviceToken}`) {
      res.writeHead(401).end();
      return;
    }

    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
      return;
    }
    if (req.method !== 'POST' || path !== '/quota') {
      res.writeHead(404, { 'Content-Type': 'application/json' }).end('{}');
      return;
    }

    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      const request = readQuotaProviderRequest(body);
      if (!request) {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({
          ok: false,
          error: { message: 'Invalid quota request.' },
        }));
        return;
      }

      const credential = request.input.credentials.openrouter;
      if (!credential || credential.type !== 'api' || !credential.key) {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
          ok: true,
          data: {
            ok: false,
            configured: true,
            error: 'No usable OpenRouter API key was provided by OpenCode. Check your OpenRouter credentials.',
            usage: null,
          },
        }));
        return;
      }

      const result = await readFreeQuota(credential.key, fetchImpl);
      const data = result.ok
        ? {
            ok: true,
            configured: true,
            planLabel: 'Free model daily limit',
            usage: {
              windows: {
                daily: {
                  usedPercent: result.limit > 0 ? Math.min(100, (result.used / result.limit) * 100) : null,
                  windowSeconds: 86400,
                  resetAt: result.resetAt,
                },
              },
            },
          }
        : { ok: false, configured: true, error: result.error, usage: null };

      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, data }));
    });
  });
}

if (process.env.OPENCHAMBER_SERVICE_PORT) {
  createServiceServer().listen(Number(process.env.OPENCHAMBER_SERVICE_PORT), '127.0.0.1');
}
