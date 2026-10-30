import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { galleryEnabled, listPending, moderate } from '@/lib/gallery/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const given = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!expected || expected.length < 12) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!galleryEnabled()) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: await listPending() });
}

const Body = z.object({ id: z.string().regex(/^[a-z0-9]{16}$/), action: z.enum(['approve', 'reject']) });

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const ok = await moderate(parsed.data.id, parsed.data.action);
  return NextResponse.json({ ok });
}
