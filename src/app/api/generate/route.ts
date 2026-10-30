import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AiError, generateImage, isSafeForKids } from '@/lib/ai/gemini';
import { ASPECT, buildEditPrompt, buildGeneratePrompt } from '@/lib/ai/prompts';
import { clientId, limitGenerate } from '@/lib/redis';
import { isPromptAllowed, sanitizePrompt } from '@/lib/safety';
import { MAX_UPLOAD_BYTES, parseDataUrl, sniffImageType } from '@/lib/image-validate';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('generate'),
    prompt: z.string().min(2).max(400),
    orientation: z.enum(['portrait', 'landscape', 'square']).default('portrait'),
    difficulty: z.enum(['easy', 'medium', 'detailed']).default('medium'),
    style: z.enum(['cartoon', 'storybook', 'kawaii', 'mandala']).default('cartoon'),
  }),
  z.object({
    mode: z.literal('edit'),
    prompt: z.string().min(2).max(400),
    image: z.string().max(Math.ceil(MAX_UPLOAD_BYTES * 1.4)),
  }),
]);

const fail = (status: number, code: string) => NextResponse.json({ error: code }, { status });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_request');
  const body = parsed.data;

  const text = sanitizePrompt(body.prompt);
  if (!isPromptAllowed(text)) return fail(422, 'inappropriate');

  const limit = await limitGenerate(await clientId(req));
  if (!limit.ok) return fail(429, 'rate_limited');

  if (!(await isSafeForKids(text))) return fail(422, 'inappropriate');

  try {
    let result;
    if (body.mode === 'generate') {
      result = await generateImage({
        prompt: buildGeneratePrompt(text, body.difficulty, body.style),
        aspectRatio: ASPECT[body.orientation],
      });
    } else {
      const img = parseDataUrl(body.image);
      if (!img) return fail(400, 'bad_image');
      const bytes = Buffer.from(img.data, 'base64');
      const real = sniffImageType(bytes);
      if (!real || bytes.byteLength > MAX_UPLOAD_BYTES) return fail(400, 'bad_image');
      result = await generateImage({ prompt: buildEditPrompt(text), baseImage: { data: img.data, mimeType: real } });
    }
    return NextResponse.json({
      image: `data:${result.mimeType};base64,${result.data}`,
      prompt: text,
      model: result.model,
    });
  } catch (err) {
    const e = err instanceof AiError ? err : new AiError('unknown', String(err));
    console.error('[generate]', e.code, e.message);
    const status = e.code === 'quota' ? 429 : e.code === 'blocked' ? 422 : e.code === 'not_configured' ? 503 : 502;
    return fail(status, e.code === 'blocked' ? 'inappropriate' : e.code);
  }
}
