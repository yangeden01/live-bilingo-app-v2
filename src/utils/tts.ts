import { getApiUrl } from './apiUrl';

let activeAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let audioContext: AudioContext | null = null;
let activeSourceNode: AudioBufferSourceNode | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    if (!audioContext && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch (e) {
    return null;
  }
};

export const stopSpeech = () => {
  try {
    if ((window as any).AndroidBridge?.stopSpeak) {
      (window as any).AndroidBridge.stopSpeak();
    }
  } catch (e) {}

  if (activeSourceNode) {
    try {
      activeSourceNode.stop();
      activeSourceNode.disconnect();
    } catch (e) {}
    activeSourceNode = null;
  }

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.src = '';
    } catch (e) {}
    activeAudio = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  currentUtterance = null;
};

/**
 * Universal bulletproof TTS Player for both Android WebView / APK, AI Studio iframe, Mobile Safari/Chrome, and Desktop.
 * Supports standard English pronunciation for single words and full paragraph sentences.
 */
export const speakText = (
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: () => void
) => {
  if (!text || !text.trim()) {
    onEnd?.();
    return;
  }

  const cleanText = text.trim();
  stopSpeech();

  let hasStarted = false;
  let hasEnded = false;

  const notifyStart = () => {
    if (!hasStarted) {
      hasStarted = true;
      onStart?.();
    }
  };

  const notifyEnd = () => {
    if (!hasEnded) {
      hasEnded = true;
      if (activeSourceNode) {
        try {
          activeSourceNode.stop();
          activeSourceNode.disconnect();
        } catch (e) {}
        activeSourceNode = null;
      }
      if (activeAudio) {
        try {
          activeAudio.pause();
          activeAudio.src = '';
        } catch (e) {}
        activeAudio = null;
      }
      currentUtterance = null;
      onEnd?.();
    }
  };

  const notifyError = () => {
    if (!hasStarted) {
      stopSpeech();
      onError?.();
    }
  };

  // 1. Android Native TTS Bridge (Highest reliability inside Android APK without CORS / network delays)
  try {
    if ((window as any).AndroidBridge?.speak) {
      notifyStart();
      (window as any).AndroidBridge.speak(cleanText);
      const wordCount = cleanText.split(/\s+/).length;
      const durationMs = Math.max(1200, Math.min(10000, wordCount * 380));
      setTimeout(() => {
        notifyEnd();
      }, durationMs);
      return;
    }
  } catch (e) {
    console.warn('[TTS] AndroidBridge.speak error, falling back to Web audio chain:', e);
  }

  // Audio Fallback Chain:
  // 1. Same-origin Server Proxy (works seamlessly in AI Studio iframe and avoids CORS)
  // 2. Youdao US Dictionary Voice
  // 3. Google Translate TTS
  const audioUrls = [
    getApiUrl(`/api/tts?text=${encodeURIComponent(cleanText.slice(0, 250))}`),
    `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanText.slice(0, 350))}&type=2`,
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText.slice(0, 200))}&tl=en&client=tw-ob`,
  ];

  // Try Web Audio API decodeAudioData for zero-blocking iframe playback
  const playWithWebAudio = async (url: string): Promise<boolean> => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return false;

      const res = await fetch(url);
      if (!res.ok) return false;
      const arrayBuffer = await res.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) return false;

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      activeSourceNode = source;

      source.onended = () => {
        activeSourceNode = null;
        notifyEnd();
      };

      notifyStart();
      source.start(0);
      return true;
    } catch (err) {
      return false;
    }
  };

  // Try HTML5 Audio fallback
  const playWithHtmlAudio = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        activeAudio = audio;

        audio.onplay = () => {
          notifyStart();
          resolve(true);
        };

        audio.onended = () => {
          notifyEnd();
        };

        audio.onerror = () => {
          resolve(false);
        };

        audio.src = url;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            resolve(false);
          });
        }
      } catch (e) {
        resolve(false);
      }
    });
  };

  // Web Speech API fallback
  const playWithWebSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        currentUtterance = utterance;
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          notifyStart();
        };
        utterance.onend = () => {
          notifyEnd();
        };
        utterance.onerror = () => {
          notifyEnd();
        };

        window.speechSynthesis.speak(utterance);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  };

  // Execution flow
  (async () => {
    for (const url of audioUrls) {
      // Try Web Audio API first (most reliable in iframe sandbox)
      const webAudioOk = await playWithWebAudio(url);
      if (webAudioOk) return;

      // Try HTML5 Audio tag
      const htmlAudioOk = await playWithHtmlAudio(url);
      if (htmlAudioOk) return;
    }

    // If all audio URLs fail, use browser Web Speech API
    const speechOk = playWithWebSpeech();
    if (!speechOk) {
      notifyError();
    }
  })();
};
