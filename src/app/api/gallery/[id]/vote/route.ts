import { NextResponse } from 'next/server';
import { z } from 'zod';
import { galleryEnabled, registerUse, vote } from '@/lib/gallery/store';
import { clientId, limitWrite } from '@/lib/redis';

export const runtime = 'nodejs';

const Body = z.object({ type: z.enum(['heart', 'like', 'use']).nullable() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!galleryEnabled()) return NextResponse.json({ error: 'gallery_disabled' }, { status: 503 });
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{16}$/.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const voter = await clientId(req);
  if (!(await limitWrite(voter))) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  if (parsed.data.type === 'use') {
    await registerUse(id);
    return NextResponse.json({ ok: true });
  }
  const result = await vote(id, voter, parsed.data.type);
  if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(result);
}
