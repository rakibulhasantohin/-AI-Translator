
export interface TranslationResult {
  detected_language: string;
  source_country: string;
  source_language: string;
  target_country: string;
  target_language: string;
  translation: string;
  alternatives: string[];
  notes: string;
  ui_suggestions: {
    primary_actions: string[];
    microcopy: string[];
  };
  tts: {
    enabled: boolean;
    voice_language_code: string;
    speak_text: string;
  };
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  sourceText: string;
  translation: string;
  sourceLang: string;
  targetLang: string;
  is_favorite?: boolean;
}

export interface CountryMapping {
  name: string;
  code: string;
  flag: string;
  languages: { name: string; code: string }[];
}
