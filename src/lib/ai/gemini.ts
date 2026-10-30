import 'server-only';
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { SAFETY_CLASSIFIER_PROMPT } from './prompts';

/**
 * All kontakt med Google skjer her, på serveren. API-nøkkelen når aldri nettleseren
 * (i v1 ble den bakt inn i JavaScript-bunten via Vite `define`).
 */

const PRIMARY_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1';
const FALLBACK_MODEL = process.env.GEMINI_IMAGE_FALLBACK_MODEL || 'gemini-3.1-flash-lite-image';
const SAFETY_MODEL = process.env.GEMINI_SAFETY_MODEL || '';

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError('not_configured', 'GEMINI_API_KEY mangler på serveren.');
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export type AiErrorCode = 'not_configured' | 'quota' | 'blocked' | 'no_image' | 'unavailable' | 'unknown';

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

const SAFETY_SETTINGS = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE }));

export interface ImageResult {
  data: string; // base64
  mimeType: string;
  model: string;
}

interface GenerateInput {
  prompt: string;
  aspectRatio?: string;
  /** Eksisterende bilde som skal redigeres (base64 uten data:-prefiks). */
  baseImage?: { data: string; mimeType: string };
}

function classify(err: unknown): AiError {
  if (err instanceof AiError) return err;
  const e = err as { status?: number; message?: string };
  const msg = e?.message ?? '';
  if (e?.status === 429 || /429|quota|RESOURCE_EXHAUSTED/i.test(msg)) return new AiError('quota', msg);
  if (e?.status === 503 || e?.status === 500 || /UNAVAILABLE|overloaded|deadline/i.test(msg)) {
    return new AiError('unavailable', msg);
  }
  if (e?.status === 404 || /not found|is not supported/i.test(msg)) return new AiError('unavailable', msg);
  return new AiError('unknown', msg || 'Ukjent feil');
}

async function callModel(model: string, input: GenerateInput): Promise<ImageResult> {
  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
  if (input.baseImage) parts.push({ inlineData: input.baseImage });

  const response = await ai().models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['IMAGE'],
      safetySettings: SAFETY_SETTINGS,
      imageConfig: {
        ...(input.aspectRatio && !input.baseImage ? { aspectRatio: input.aspectRatio } : {}),
        imageSize: '2K',
      },
    },
  });

  const candidate = response.candidates?.[0];
  if (response.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT' || candidate?.finishReason === 'IMAGE_SAFETY') {
    throw new AiError('blocked', 'Innholdet ble stoppet av sikkerhetsfilteret.');
  }
  for (const part of candidate?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png', model };
    }
  }
  throw new AiError('no_image', 'Modellen returnerte ikke noe bilde.');
}

/** Primærmodell → fallback ved overbelastning/ukjent modell. Blokkering og kvote gir ikke retry. */
export async function generateImage(input: GenerateInput): Promise<ImageResult> {
  try {
    return await callModel(PRIMARY_MODEL, input);
  } catch (err) {
    const e = classify(err);
    const retryable = e.code === 'unavailable' || e.code === 'no_image' || e.code === 'unknown';
    if (!retryable || !FALLBACK_MODEL || FALLBACK_MODEL === PRIMARY_MODEL) throw e;
    console.warn(`[ai] ${PRIMARY_MODEL} feilet (${e.code}), prøver ${FALLBACK_MODEL}`);
    try {
      return await callModel(FALLBACK_MODEL, input);
    } catch (err2) {
      throw classify(err2);
    }
  }
}

/** Lag 2 i innholdssjekken. Feiler «åpent» (true) hvis modellen ikke svarer – lag 1 og 3 gjelder fortsatt. */
export async function isSafeForKids(text: string): Promise<boolean> {
  if (!SAFETY_MODEL) return true;
  try {
    const res = await ai().models.generateContent({
      model: SAFETY_MODEL,
      contents: SAFETY_CLASSIFIER_PROMPT(text),
      config: { maxOutputTokens: 5, temperature: 0 },
    });
    return !/UNSAFE/i.test(res.text ?? '');
  } catch (err) {
    console.warn('[ai] sikkerhetsklassifisering feilet', (err as Error).message);
    return true;
  }
}
