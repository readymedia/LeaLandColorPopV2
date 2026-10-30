import 'server-only';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/** Upstash Redis via Vercel Marketplace. Alt er valgfritt – appen fungerer uten (galleri slås av). */
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis: Redis | null = url && token ? new Redis({ url, token }) : null;

const perHour = Number(process.env.RATE_LIMIT_PER_HOUR || 20);

const generateLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(perHour, '1 h'), prefix: 'lealand:rl:gen' })
  : null;

const writeLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '10 m'), prefix: 'lealand:rl:write' })
  : null;

export async function limitGenerate(id: string): Promise<{ ok: boolean; reset?: number }> {
  if (!generateLimiter) return { ok: true };
  const r = await generateLimiter.limit(id);
  return { ok: r.success, reset: r.reset };
}

export async function limitWrite(id: string): Promise<boolean> {
  if (!writeLimiter) return true;
  return (await writeLimiter.limit(id)).success;
}

/** Identifiserer klienten uten å lagre IP i klartekst. */
export async function clientId(req: Request): Promise<string> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const device = req.headers.get('x-device-id')?.slice(0, 64) || '';
  const bytes = new TextEncoder().encode(`${ip}|${device}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Buffer.from(hash).toString('base64url').slice(0, 22);
}
