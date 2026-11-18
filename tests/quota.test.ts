import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createServiceServer, readFreeQuota } from '../service/main.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const quotaPayload = {
  data: { free_model_daily_requests: { used: 12, limit: 50, remaining: 38 } },
};

describe('OpenRouter free daily quota', () => {
  test('reads the API values and computes a next-UTC-day reset', async () => {
    const fetchMock = mock(async () => reply(quotaPayload));
    const result = await readFreeQuota('test-key-only', fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.used).toBe(12);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(38);
      expect(result.resetAt % 86_400_000).toBe(0);
    }
    expect(fetchMock).toHaveBeenCalledWith('https://openrouter.ai/api/v1/key', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-key-only' },
    });
  });

  test('returns a useful error for an API failure', async () => {
    const result = await readFreeQuota('test-key-only', (async () => reply({}, 401)) as unknown as typeof fetch);
    expect(result).toEqual({
      ok: false,
      error: 'OpenRouter rejected the saved API key. Check your OpenRouter credentials in OpenCode.',
    });
  });

  test('does not invent values when the quota field is missing', async () => {
    const result = await readFreeQuota('test-key-only', (async () => reply({ data: {} })) as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('"used"');
  });

  test('requires service bearer authentication for health and quota route', async () => {
    const server = createServiceServer({ OPENCHAMBER_SERVICE_TOKEN: 'test-service-token' }, (async () => reply(quotaPayload)) as unknown as typeof fetch);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server address');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      const unauthorizedHealth = await fetch(`${base}/health`);
      expect(unauthorizedHealth.status).toBe(401);
      const health = await fetch(`${base}/health`, { headers: { Authorization: 'Bearer test-service-token' } });
      expect(health.status).toBe(200);

      const quota = await fetch(`${base}/quota`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-service-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          v: 1,
          requestId: 'test-request',
          method: 'usage.read',
          provider: 'ext-openrouter-free-quota',
          input: { credentials: { openrouter: { type: 'api', key: 'test-key-only' } } },
        }),
      });
      expect(quota.status).toBe(200);
      const body = await quota.json() as { ok: boolean; data: { ok: boolean; usage: { windows: Record<string, { usedPercent: number; valueLabel?: string; value?: unknown }> } } };
      expect(body.ok).toBe(true);
      expect(body.data.ok).toBe(true);
      expect(body.data.usage.windows.daily?.usedPercent).toBe(24);
      expect(body.data.usage.windows.daily?.valueLabel).toBeUndefined();
      expect(body.data.usage.windows.daily?.value).toBeUndefined();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
