import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";
import { TranslationResult } from "../types";

/**
 * Extracts and parses JSON from Gemini's output.
 * Handles cases where the model might include markdown code blocks.
 */
const parseGeminiResponse = (text: string): any => {
  if (!text) throw new Error("Empty response from AI");
  
  try {
    // Try simple parse first
    return JSON.parse(text);
  } catch (e) {
    try {
      // If simple parse fails, try to extract from markdown blocks or find the first { and last }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (innerError) {
      console.error("Critical JSON Parse Error. Raw text:", text);
    }
    throw new Error("Invalid translation response format");
  }
};

export const translateText = async (
  text: string,
  targetLang: string,
  targetCountry: string,
  sourceLang: string = 'auto',
  sourceCountry: string = ''
): Promise<TranslationResult> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing. Please set it in your environment variables.");
    throw new Error("API Key configuration missing");
  }

  // Initialize AI directly inside the call to ensure we always have fresh environment variables
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Input data to translate: "${text.replace(/"/g, '\\"')}"
    Source settings: Country: ${sourceCountry || 'Unknown'}, Language: ${sourceLang}
    Target settings: Country: ${targetCountry}, Language: ${targetLang}
    
    Translate accurately and return a valid JSON object only.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You are "আমাদের AI Translator". 
        Translate the user input naturally based on the target country and language.
        Detection is required if source_language is 'auto'.
        Response MUST be a clean JSON object following the schema provided. 
        NO markdown, NO extra text.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detected_language: { type: Type.STRING },
            source_country: { type: Type.STRING },
            source_language: { type: Type.STRING },
            target_country: { type: Type.STRING },
            target_language: { type: Type.STRING },
            translation: { type: Type.STRING },
            alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
            notes: { type: Type.STRING },
            ui_suggestions: {
              type: Type.OBJECT,
              properties: {
                primary_actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                microcopy: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            tts: {
              type: Type.OBJECT,
              properties: {
                enabled: { type: Type.BOOLEAN },
                voice_language_code: { type: Type.STRING },
                speak_text: { type: Type.STRING }
              }
            }
          },
          required: ["detected_language", "source_language", "translation", "tts"]
        }
      }
    });

    return parseGeminiResponse(response.text);
  } catch (error: any) {
    console.error("Translation API Request failed:", error);
    throw error;
  }
};

export const generateTTS = async (text: string, voiceName: string = 'Kore'): Promise<Uint8Array> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error("API Key configuration missing");
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("TTS generation failed");
    
    return decode(base64Audio);
  } catch (error) {
    console.error("TTS API Request failed:", error);
    throw error;
  }
};

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}