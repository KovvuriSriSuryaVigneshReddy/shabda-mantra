import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// Model configuration
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022";

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB decoded
const MAX_PROMPT_LENGTH = 500;
const DEFAULT_PROMPT = "Identify the main subject of this image and describe it in detail.";

const SYSTEM_PROMPT = `You are ShabdaMantra, a bilingual vision assistant. Analyze the image the user provides and answer their request with a detailed, accurate description: what the main object or subject is, its notable features, colors, materials, context, and any visible text.

Respond with ONLY a JSON object, no markdown fences and no extra text, using exactly these keys:
{
  "englishName": "The name of the main object in English, 1-4 words, no description.",
  "hindiName": "The same name in Hindi, written in Devanagari script.",
  "english": "Your detailed analysis in English (3-6 sentences).",
  "hindi": "The same analysis translated into Hindi, written in Devanagari script."
}`;

interface AnalysisResult {
  englishName: string;
  hindiName: string;
  english: string;
  hindi: string;
}

interface IdentifyRequestBody {
  imageBase64?: unknown;
  mediaType?: unknown;
  prompt?: unknown;
}

function getMockAnalysis(promptText: string): AnalysisResult {
  return {
    englishName: "Smart Device / Subject",
    hindiName: "स्मार्ट उपकरण / विषय",
    english:
      "This is a local demonstration response. The image was successfully captured and processed locally. To enable real-time Gemini AI vision analysis, add your free GEMINI_API_KEY in .env.local.",
    hindi:
      "यह एक स्थानीय डेमो उत्तर है। छवि स्थानीय रूप से सफलतापूर्वक प्राप्त की गई। रीयल-टाइम जेमिनी विज़न विश्लेषण सक्षम करने के लिए .env.local में अपनी निःशुल्क GEMINI_API_KEY जोड़ें।",
  };
}

async function runGeminiVision(
  apiKey: string,
  mediaType: string,
  rawBase64: string,
  prompt: string
): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey });
  const candidateModels = Array.from(
    new Set([GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest"])
  );

  let lastError: unknown;
  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mediaType,
                  data: rawBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (text) {
        return parseAnalysis(text);
      }
    } catch (err) {
      lastError = err;
      console.warn(`[identify] Gemini model ${model} failed, trying fallback:`, err);
    }
  }

  throw lastError ?? new Error("Gemini returned an empty response.");
}

async function runAnthropicVision(
  apiKey: string,
  mediaType: MediaType,
  rawBase64: string,
  prompt: string
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: rawBase64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content.");
  }
  return parseAnalysis(textBlock.text);
}

export async function POST(request: NextRequest) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const isMock = process.env.MOCK_MODE === "true";

    const body = (await request.json()) as IdentifyRequestBody;

    if (typeof body.imageBase64 !== "string" || body.imageBase64.length === 0) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    // Accept either raw base64 or a full data URL ("data:image/jpeg;base64,...").
    const dataUrlMatch = /^data:([^;]+);base64,([\s\S]*)$/.exec(body.imageBase64);
    const rawBase64 = (dataUrlMatch ? dataUrlMatch[2] : body.imageBase64).replace(/\s/g, "");
    const declaredType = dataUrlMatch ? dataUrlMatch[1] : body.mediaType;

    if (!ALLOWED_MEDIA_TYPES.includes(declaredType as MediaType)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." },
        { status: 415 }
      );
    }
    const mediaType = declaredType as MediaType;

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64)) {
      return NextResponse.json({ error: "Image data is not valid base64." }, { status: 400 });
    }

    const decodedBytes = Math.floor((rawBase64.length * 3) / 4);
    if (decodedBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large. The limit is 5 MB." }, { status: 413 });
    }

    const userPrompt =
      typeof body.prompt === "string" && body.prompt.trim()
        ? body.prompt.trim().slice(0, MAX_PROMPT_LENGTH)
        : DEFAULT_PROMPT;

    if (isMock) {
      return NextResponse.json(getMockAnalysis(userPrompt));
    }

    // 1. Prefer Gemini API if key is available
    if (geminiKey) {
      try {
        const result = await runGeminiVision(geminiKey, mediaType, rawBase64, userPrompt);
        return NextResponse.json(result);
      } catch (geminiErr) {
        console.error("[identify] Gemini error:", geminiErr);
        if (anthropicKey) {
          console.info("[identify] Falling back to Anthropic...");
        } else {
          let msg = geminiErr instanceof Error ? geminiErr.message : "Gemini API request failed.";
          try {
            const parsed = JSON.parse(msg);
            if (parsed?.error?.message) msg = parsed.error.message;
          } catch {
            // keep msg
          }
          return NextResponse.json({ error: `Gemini API error: ${msg}` }, { status: 502 });
        }
      }
    }

    // 2. Fall back to Anthropic if available
    if (anthropicKey) {
      try {
        const result = await runAnthropicVision(anthropicKey, mediaType, rawBase64, userPrompt);
        return NextResponse.json(result);
      } catch (anthropicErr) {
        console.error("[identify] Anthropic error:", anthropicErr);
        if (process.env.FALLBACK_TO_MOCK_ON_ERROR === "true") {
          return NextResponse.json(getMockAnalysis(userPrompt));
        }

        if (anthropicErr instanceof Anthropic.APIError) {
          let friendly = anthropicErr.message;
          try {
            const jsonMatch = anthropicErr.message.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed?.error?.message) {
                friendly = parsed.error.message;
              }
            }
          } catch {
            // keep raw message
          }
          return NextResponse.json(
            { error: `Claude API error: ${friendly}` },
            { status: anthropicErr.status && anthropicErr.status >= 400 ? anthropicErr.status : 502 }
          );
        }

        return NextResponse.json(
          { error: anthropicErr instanceof Error ? anthropicErr.message : "Failed to analyze image." },
          { status: 500 }
        );
      }
    }

    // 3. If neither key is configured, fallback to mock demo or guide user
    return NextResponse.json(
      {
        error:
          "No AI vision API key found. Please add GEMINI_API_KEY (free from aistudio.google.com/apikey) to .env.local, or set MOCK_MODE=true for testing.",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("[identify] request failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze the image." },
      { status: 500 }
    );
  }
}

function parseAnalysis(raw: string): AnalysisResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (typeof parsed.english === "string" || typeof parsed.englishName === "string") {
      return {
        englishName: asString(parsed.englishName),
        hindiName: asString(parsed.hindiName),
        english: asString(parsed.english),
        hindi: asString(parsed.hindi),
      };
    }
  } catch {
    // fall through
  }
  return { englishName: "", hindiName: "", english: cleaned, hindi: "" };
}
