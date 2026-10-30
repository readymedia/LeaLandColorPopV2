import 'server-only';
import { put, del } from '@vercel/blob';
import { redis } from '@/lib/redis';
import type { GalleryItem, GalleryKind, GallerySort, VoteType } from './types';

/**
 * Kunstveggen.
 * v1 lagret hele galleriet i én JSON-fil i Blob som ble lest/skrevet ved hver stemme
 * (race conditions, tregt, skalerer ikke). v2: bilder i Blob, metadata/tellere i Redis
 * med atomiske operasjoner og sorterte sett for «nyeste» og «populære».
 */

const K = {
  item: (id: string) => `g:item:${id}`,
  votes: (id: string) => `g:votes:${id}`,
  newest: (kind: GalleryKind) => `g:new:${kind}`,
  popular: (kind: GalleryKind) => `g:pop:${kind}`,
  pending: 'g:pending',
};

export const galleryEnabled = () => Boolean(redis && process.env.BLOB_READ_WRITE_TOKEN);

function requireRedis() {
  if (!redis) throw new Error('Galleri er ikke konfigurert');
  return redis;
}

const score = (i: Pick<GalleryItem, 'hearts' | 'likes' | 'uses'>) => i.hearts * 3 + i.likes + i.uses * 0.5;

type Raw = Record<string, string | number | null>;
function parse(raw: Raw | null): GalleryItem | null {
  if (!raw || !raw.id) return null;
  return {
    id: String(raw.id),
    url: String(raw.url),
    prompt: String(raw.prompt ?? ''),
    author: String(raw.author ?? 'Anonym kunstner'),
    kind: (raw.kind as GalleryKind) ?? 'artwork',
    templateId: raw.templateId ? String(raw.templateId) : undefined,
    templateUrl: raw.templateUrl ? String(raw.templateUrl) : undefined,
    status: (raw.status as GalleryItem['status']) ?? 'pending',
    createdAt: Number(raw.createdAt ?? 0),
    hearts: Number(raw.hearts ?? 0),
    likes: Number(raw.likes ?? 0),
    uses: Number(raw.uses ?? 0),
  };
}

export async function getItem(id: string): Promise<GalleryItem | null> {
  return parse((await requireRedis().hgetall(K.item(id))) as Raw | null);
}

async function getItems(ids: string[]): Promise<GalleryItem[]> {
  if (!ids.length) return [];
  const r = requireRedis();
  const p = r.pipeline();
  ids.forEach((id) => p.hgetall(K.item(id)));
  const rows = (await p.exec()) as (Raw | null)[];
  return rows.map(parse).filter((x): x is GalleryItem => Boolean(x));
}

export async function listGallery(opts: { kind: GalleryKind; sort: GallerySort; page: number; limit: number }) {
  const r = requireRedis();
  const key = opts.sort === 'popular' ? K.popular(opts.kind) : K.newest(opts.kind);
  const start = (opts.page - 1) * opts.limit;
  const [ids, total] = await Promise.all([
    r.zrange<string[]>(key, start, start + opts.limit - 1, { rev: true }),
    r.zcard(key),
  ]);
  return { items: await getItems(ids), total, page: opts.page, totalPages: Math.max(1, Math.ceil(total / opts.limit)) };
}

export async function listPending(limit = 50) {
  const ids = await requireRedis().zrange<string[]>(K.pending, 0, limit - 1);
  return getItems(ids);
}

export async function createItem(input: {
  image: Uint8Array;
  mimeType: string;
  prompt: string;
  author: string;
  kind: GalleryKind;
  templateId?: string;
  autoApprove: boolean;
}): Promise<GalleryItem> {
  const r = requireRedis();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const ext = input.mimeType === 'image/webp' ? 'webp' : input.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const blob = await put(`gallery/${input.kind}/${id}.${ext}`, Buffer.from(input.image), {
    access: 'public',
    contentType: input.mimeType,
    addRandomSuffix: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });

  let templateUrl: string | undefined;
  if (input.templateId) templateUrl = (await getItem(input.templateId))?.url;

  const item: GalleryItem = {
    id,
    url: blob.url,
    prompt: input.prompt,
    author: input.author,
    kind: input.kind,
    templateId: templateUrl ? input.templateId : undefined,
    templateUrl,
    status: input.autoApprove ? 'approved' : 'pending',
    createdAt: Date.now(),
    hearts: 0,
    likes: 0,
    uses: 0,
  };

  const p = r.pipeline();
  p.hset(K.item(id), Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)));
  if (item.status === 'approved') {
    p.zadd(K.newest(item.kind), { score: item.createdAt, member: id });
    p.zadd(K.popular(item.kind), { score: 0, member: id });
  } else {
    p.zadd(K.pending, { score: item.createdAt, member: id });
  }
  await p.exec();
  return item;
}

export async function moderate(id: string, action: 'approve' | 'reject'): Promise<boolean> {
  const r = requireRedis();
  const item = await getItem(id);
  if (!item) return false;
  if (action === 'approve') {
    const p = r.pipeline();
    p.hset(K.item(id), { status: 'approved' });
    p.zrem(K.pending, id);
    p.zadd(K.newest(item.kind), { score: item.createdAt, member: id });
    p.zadd(K.popular(item.kind), { score: score(item), member: id });
    await p.exec();
  } else {
    const p = r.pipeline();
    p.del(K.item(id));
    p.del(K.votes(id));
    p.zrem(K.pending, id);
    p.zrem(K.newest(item.kind), id);
    p.zrem(K.popular(item.kind), id);
    await p.exec();
    await del(item.url).catch(() => undefined);
  }
  return true;
}

const FIELD: Record<VoteType, 'hearts' | 'likes'> = { heart: 'hearts', like: 'likes' };

/**
 * Én stemme per enhet per bilde, håndhevet på serveren (v1 stolte på localStorage).
 * `type: null` fjerner stemmen; ny type bytter stemme.
 */
export async function vote(id: string, voter: string, type: VoteType | null) {
  const r = requireRedis();
  const item = await getItem(id);
  if (!item || item.status !== 'approved') return null;

  const previous = (await r.hget<VoteType>(K.votes(id), voter)) ?? null;
  if (previous === type) return { hearts: item.hearts, likes: item.likes, myVote: type };

  const p = r.pipeline();
  if (previous) p.hincrby(K.item(id), FIELD[previous], -1);
  if (type) {
    p.hincrby(K.item(id), FIELD[type], 1);
    p.hset(K.votes(id), { [voter]: type });
  } else {
    p.hdel(K.votes(id), voter);
  }
  await p.exec();

  const updated = (await getItem(id))!;
  updated.hearts = Math.max(0, updated.hearts);
  updated.likes = Math.max(0, updated.likes);
  await r.zadd(K.popular(updated.kind), { score: score(updated), member: id });
  return { hearts: updated.hearts, likes: updated.likes, myVote: type };
}

export async function myVotes(ids: string[], voter: string): Promise<Record<string, VoteType>> {
  if (!ids.length) return {};
  const r = requireRedis();
  const p = r.pipeline();
  ids.forEach((id) => p.hget(K.votes(id), voter));
  const res = (await p.exec()) as (VoteType | null)[];
  return Object.fromEntries(ids.map((id, i) => [id, res[i]]).filter(([, v]) => v)) as Record<string, VoteType>;
}

/** Teller når noen henter en mal fra veggen for å fargelegge den selv. */
export async function registerUse(id: string) {
  const r = requireRedis();
  const item = await getItem(id);
  if (!item || item.status !== 'approved') return;
  await r.hincrby(K.item(id), 'uses', 1);
  await r.zadd(K.popular(item.kind), { score: score({ ...item, uses: item.uses + 1 }), member: id });
}
