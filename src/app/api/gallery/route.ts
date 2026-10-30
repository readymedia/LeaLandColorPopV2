import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createItem, galleryEnabled, listGallery, myVotes } from '@/lib/gallery/store';
import type { GalleryPage } from '@/lib/gallery/types';
import { clientId, limitWrite } from '@/lib/redis';
import { isPromptAllowed, sanitizeNickname, sanitizePrompt } from '@/lib/safety';
import { MAX_UPLOAD_BYTES, parseDataUrl, sniffImageType } from '@/lib/image-validate';

export const runtime = 'nodejs';

const empty: GalleryPage = { enabled: false, items: [], total: 0, page: 1, totalPages: 1, myVotes: {} };

export async function GET(req: Request) {
  if (!galleryEnabled()) return NextResponse.json(empty);
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') === 'template' ? 'template' : 'artwork';
  const sort = url.searchParams.get('sort') === 'newest' ? 'newest' : 'popular';
  const page = Math.max(1, Math.min(500, Number(url.searchParams.get('page')) || 1));
  const limit = 20;

  const data = await listGallery({ kind, sort, page, limit });
  const votes = await myVotes(data.items.map((i) => i.id), await clientId(req));
  const res: GalleryPage = { enabled: true, ...data, myVotes: votes };
  return NextResponse.json(res, { headers: { 'Cache-Control': 'private, max-age=10' } });
}

const ShareBody = z.object({
  image: z.string(),
  prompt: z.string().max(400),
  author: z.string().max(40).optional(),
  kind: z.enum(['artwork', 'template']),
  templateId: z.string().regex(/^[a-z0-9]{16}$/).optional(),
});

export async function POST(req: Request) {
  if (!galleryEnabled()) return NextResponse.json({ error: 'gallery_disabled' }, { status: 503 });
  const id = await clientId(req);
  if (!(await limitWrite(id))) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const parsed = ShareBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const img = parseDataUrl(parsed.data.image);
  if (!img) return NextResponse.json({ error: 'bad_image' }, { status: 400 });
  const bytes = Buffer.from(img.data, 'base64');
  const mimeType = sniffImageType(bytes);
  if (!mimeType || bytes.byteLength > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'bad_image' }, { status: 400 });

  const prompt = sanitizePrompt(parsed.data.prompt);
  if (!isPromptAllowed(prompt)) return NextResponse.json({ error: 'inappropriate' }, { status: 422 });

  const item = await createItem({
    image: bytes,
    mimeType,
    prompt,
    author: sanitizeNickname(parsed.data.author ?? ''),
    kind: parsed.data.kind,
    templateId: parsed.data.templateId,
    autoApprove: process.env.GALLERY_AUTO_APPROVE === 'true',
  });
  return NextResponse.json({ item });
}
