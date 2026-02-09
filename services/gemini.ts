
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResult } from "../types";

// Lazy initialization of AI client
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    // Priority: process.env.API_KEY (injected by platform) -> window.process.env -> empty string
    const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || 
                   (window as any).process?.env?.API_KEY || "";
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

/**
 * Extracts and parses JSON from a potentially messy string output.
 */
const parseGeminiResponse = (text: string): any => {
  try {
    // Try to find a JSON object in the string using regex
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanText = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON. Raw output:", text);
    throw new Error("Invalid response format from AI");
  }
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
    Input parameters:
    - Text: "${text.replace(/"/g, '\\"')}"
    - Target Language: ${targetLang}
    - Target Country: ${targetCountry}
    - Source Language (optional): ${sourceLang}
    
    Translate the text and return strictly a JSON object. Do not include markdown formatting or explanations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: `You are "আমাদের AI Translator", a precision translation engine.
        Instructions:
        1. Translate accurately and naturally.
        2. Always return a single JSON object.
        3. Never wrap the JSON in markdown code blocks like \`\`\`json.
        4. Detect source language if set to 'auto'.
        5. Provide a 'tts' config with voice_language_code suitable for target_language.`,
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

    const result = parseGeminiResponse(response.text || '{}');
    return result;
  } catch (error: any) {
    console.error("Translation API Error:", error);
    throw error;
  }
};

export const generateTTS = async (text: string, voiceName: string = 'Kore'): Promise<Uint8Array> => {
  const ai = getAI();
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
    if (!base64Audio) throw new Error("No audio data received from Gemini TTS");
    
    return decode(base64Audio);
  } catch (error) {
    console.error("TTS API Error:", error);
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
