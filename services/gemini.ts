
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResult } from "../types";

// Lazy initialization of AI client
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    // Falls back to empty string if process.env.API_KEY is missing to prevent reference error
    const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || "";
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const translateText = async (
  text: string,
  targetLang: string,
  targetCountry: string,
  sourceLang: string = 'auto',
  sourceCountry: string = ''
): Promise<TranslationResult> => {
  const ai = getAI();
  const prompt = `
    Input JSON:
    {
      "input_text": "${text.replace(/"/g, '\\"')}",
      "source_country": "${sourceCountry}",
      "source_language": "${sourceLang}",
      "target_country": "${targetCountry}",
      "target_language": "${targetLang}",
      "need_voice": true
    }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: `You are "আমাদের AI Translator", a multilingual translation engine and UX assistant.
      Support translation between official languages of 200+ countries.
      Provide accurate, context-aware, and culturally appropriate translations.
      Return ONLY in the specified JSON format.`,
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

  return JSON.parse(response.text || '{}');
};

export const generateTTS = async (text: string, voiceName: string = 'Kore'): Promise<Uint8Array> => {
  const ai = getAI();
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
  if (!base64Audio) throw new Error("No audio data received");
  
  return decode(base64Audio);
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