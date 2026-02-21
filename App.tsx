import React, { useState, useEffect, useRef } from 'react';
import { COUNTRIES, LANGUAGES } from './constants';
import { translateText, generateTTS, decodeAudioData } from './services/gemini';
import { TranslationResult, HistoryItem } from './types';

export default function App() {
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [sourceCountry, setSourceCountry] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetCountry, setTargetCountry] = useState('US');
  const [targetLang, setTargetLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [detectedLang, setDetectedLang] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [feedback, setFeedback] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [notes, setNotes] = useState('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved as 'light' | 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = () => {
    try {
      const savedHistory = localStorage.getItem('translation_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem('translation_history', JSON.stringify(newHistory));
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Debounced Translation Effect
  useEffect(() => {
    if (!sourceText.trim()) {
      setTargetText('');
      setDetectedLang('');
      setAlternatives([]);
      setNotes('');
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      handleTranslate();
    }, 200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [sourceText, sourceLang, sourceCountry, targetLang, targetCountry]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const lastRequestRef = useRef<number>(0);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    const requestId = Date.now();
    lastRequestRef.current = requestId;
    setLoading(true);
    try {
      const result = await translateText(sourceText, targetLang, targetCountry, sourceLang, sourceCountry);
      
      // Only update if this is the latest request
      if (requestId !== lastRequestRef.current) return;

      setTargetText(result.translation);
      setDetectedLang(result.detected_language);
      setNotes(result.notes);
      setAlternatives(result.alternatives || []);
      
      const newHistoryItem: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        sourceText: sourceText,
        translation: result.translation,
        sourceLang: result.detected_language,
        targetLang: result.target_language,
        is_favorite: false
      };

      const updatedHistory = [newHistoryItem, ...history].slice(0, 50);
      saveHistory(updatedHistory);
    } catch (error: any) {
      console.error(error);
      setFeedback(error.message || 'Error translating text.');
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = async (text: string) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    setFeedback('Speaking...');
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const audioBytes = await generateTTS(text);
      const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsSpeaking(false);
        setFeedback('');
      };
      source.start();
    } catch (error) {
      console.error(error);
      setIsSpeaking(false);
      setFeedback('Error generating speech.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setFeedback('Copied!');
    setTimeout(() => setFeedback(''), 2000);
  };

  const handleSwap = () => {
    const tempText = sourceText;
    const tempCountry = sourceCountry;
    const tempLang = sourceLang;
    
    setSourceText(targetText);
    setTargetText(tempText);
    setSourceCountry(targetCountry);
    setSourceLang(targetLang);
    setTargetCountry(tempCountry);
    setTargetLang(tempLang);
  };

  const clearInput = () => {
    setSourceText('');
    setTargetText('');
    setDetectedLang('');
    setAlternatives([]);
    setNotes('');
  };

  const toggleFavorite = (id: string, currentVal: boolean) => {
    const updatedHistory = history.map(item => item.id === id ? { ...item, is_favorite: !currentVal } : item);
    saveHistory(updatedHistory);
  };

  const clearAllHistory = () => {
    if (!confirm('Are you sure you want to clear all history?')) return;
    saveHistory([]);
    setFeedback('History Cleared');
    setTimeout(() => setFeedback(''), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <i className="fa-solid fa-language text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">আমাদের AI Translator</h1>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest">Guest Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun text-yellow-400'}`}></i>
          </button>
          
          <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full animate-pulse bg-blue-500"></span>
            Local Storage Active
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Translator Panel */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row min-h-[400px]">
            
            {/* Source Panel */}
            <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700 p-6">
              <div className="flex flex-wrap gap-2 mb-4">
                <select 
                  value={sourceCountry} 
                  onChange={(e) => setSourceCountry(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer transition-colors max-w-[150px]"
                >
                  <option value="">🌍 Auto Country</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                </select>
                <select 
                  value={sourceLang} 
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer transition-colors"
                >
                  <option value="auto">✨ Auto-detect Language</option>
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>
              
              <div className="relative flex-1">
                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Type anything here..."
                  className="w-full h-full min-h-[200px] text-xl text-gray-800 dark:text-slate-100 bg-transparent placeholder-gray-400 dark:placeholder-slate-500 resize-none border-none focus:ring-0 outline-none custom-scrollbar leading-relaxed"
                />
                <div className="absolute bottom-0 right-0 p-2 text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                  {sourceText.length} chars
                </div>
                {detectedLang && (
                  <div className="absolute bottom-0 left-0 p-2 text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <i className="fa-solid fa-wand-magic-sparkles"></i> {LANGUAGES.find(l => l.code === detectedLang)?.name || detectedLang}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSpeak(sourceText)} className="p-2 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Speak source text">
                    <i className="fa-solid fa-volume-high"></i>
                  </button>
                  <button onClick={() => copyToClipboard(sourceText)} className="p-2 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Copy source text">
                    <i className="fa-solid fa-copy"></i>
                  </button>
                  <button onClick={clearInput} className="p-2 text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Clear input">
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Swap Button (Desktop) */}
            <div className="hidden md:flex items-center justify-center -mx-4 z-10">
              <button 
                onClick={handleSwap}
                className="w-10 h-10 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full shadow-md flex items-center justify-center text-gray-500 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 transition-all hover:scale-110"
              >
                <i className="fa-solid fa-right-left"></i>
              </button>
            </div>

            {/* Target Panel */}
            <div className="flex-1 flex flex-col p-6 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex flex-wrap gap-2 mb-4">
                <select 
                  value={targetCountry} 
                  onChange={(e) => setTargetCountry(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-200 shadow-sm rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer transition-colors max-w-[150px]"
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                </select>
                <select 
                  value={targetLang} 
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-200 shadow-sm rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer transition-colors"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>

              <div className="relative flex-1">
                {loading ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 py-20">
                    <div className="w-12 h-12 border-4 border-blue-100 dark:border-blue-900/30 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                    <p className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-xs animate-pulse">Processing...</p>
                  </div>
                ) : (
                  <div className={`w-full h-full text-xl text-gray-800 dark:text-slate-100 break-words custom-scrollbar overflow-y-auto whitespace-pre-wrap transition-all duration-300 leading-relaxed ${!targetText && sourceText ? 'opacity-30 blur-[1px]' : 'opacity-100 blur-0'}`}>
                    {targetText || (sourceText ? 'Translating...' : <span className="text-gray-300 dark:text-slate-600 italic">Translation will appear instantly as you type</span>)}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSpeak(targetText)} className="p-2 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Speak translation">
                    <i className="fa-solid fa-volume-high"></i>
                  </button>
                  <button onClick={() => copyToClipboard(targetText)} className="p-2 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Copy translation">
                    <i className="fa-solid fa-copy"></i>
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-full text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                     <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500 animate-ping' : 'bg-green-500 animate-pulse'}`}></span>
                     {loading ? 'Thinking' : 'Sync Active'}
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contextual Info */}
          {(notes || alternatives.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alternatives.length > 0 && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm transition-colors">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2 uppercase tracking-tight">
                    <i className="fa-solid fa-shuffle text-blue-500"></i> Alternatives
                  </h3>
                  <ul className="space-y-2">
                    {alternatives.map((alt, i) => (
                      <li key={i} className="group flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <span className="text-gray-600 dark:text-slate-400 text-sm">{alt}</span>
                        <button onClick={() => setTargetText(alt)} className="opacity-0 group-hover:opacity-100 p-1 text-xs text-blue-600 dark:text-blue-400 font-medium">Use</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {notes && (
                <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm transition-colors">
                  <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-tight">
                    <i className="fa-solid fa-circle-info text-blue-500"></i> AI Context
                  </h3>
                  <p className="text-sm text-blue-800/80 dark:text-blue-300/80 leading-relaxed italic">
                    "{notes}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: History & Favorites */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col h-[600px] transition-colors">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-blue-500"></i> History
              </h3>
              <button 
                onClick={clearAllHistory}
                className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 font-medium transition-colors"
              >
                Clear
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center text-gray-200 dark:text-slate-600">
                    <i className="fa-solid fa-database text-2xl"></i>
                  </div>
                  <p className="text-sm text-gray-400 dark:text-slate-500">No translations yet.</p>
                </div>
              ) : (
                history.map(item => (
                  <div key={item.id} className="group bg-gray-50 dark:bg-slate-700/50 p-3 rounded-xl hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-blue-100 dark:hover:border-blue-900/50" onClick={() => {
                    setSourceText(item.sourceText);
                    setTargetText(item.translation);
                  }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{item.sourceLang} → {item.targetLang}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id, item.is_favorite || false); }}
                        className={`text-sm transition-colors ${item.is_favorite ? 'text-yellow-500' : 'text-gray-300 dark:text-slate-600 group-hover:text-gray-400 dark:group-hover:text-slate-400'}`}
                      >
                        <i className={`fa-${item.is_favorite ? 'solid' : 'regular'} fa-star`}></i>
                      </button>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-slate-200 line-clamp-2 font-medium mb-1">{item.sourceText}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2">{item.translation}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Feedback Toasts */}
      {feedback && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="text-sm font-semibold tracking-wide">{feedback}</span>
        </div>
      )}
      
      {/* Footer */}
      <footer className="py-6 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-center transition-colors">
        <p className="text-gray-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[2px]">
          আমাদের AI Translator • Real-time Local Engine
        </p>
      </footer>
    </div>
  );
}
