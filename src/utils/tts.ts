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

// Pre-fetch speech synthesis voices for natural sounding US English
let cachedVoices: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const updateVoices = () => {
    try {
      cachedVoices = window.speechSynthesis.getVoices();
    } catch (e) {}
  };
  updateVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }
}

/**
 * Universal bulletproof TTS Player for both Android WebView / APK, AI Studio iframe, Mobile Safari/Chrome, and Desktop.
 * Supports standard English pronunciation for single words and full paragraph sentences.
 * Ensures NATURAL, PITCH-PRESERVED slow speech (0.75x, 0.5x, 1x) without deep/monster robotic tones.
 */
export const speakText = (
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: () => void,
  rate: number = 1.0
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

  // 1. Android Native TTS Bridge (Highest reliability inside Android APK with natural pitch preservation)
  try {
    if ((window as any).AndroidBridge?.speak) {
      notifyStart();
      try {
        (window as any).AndroidBridge.speak(cleanText, rate);
      } catch (e) {
        (window as any).AndroidBridge.speak(cleanText);
      }
      const wordCount = cleanText.split(/\s+/).length;
      const durationMs = Math.max(1500, Math.min(25000, Math.round((wordCount * 450) / Math.max(0.4, rate))));
      setTimeout(() => {
        notifyEnd();
      }, durationMs);
      return;
    }
  } catch (e) {
    console.warn('[TTS] AndroidBridge.speak error, falling back to Web audio chain:', e);
  }

  // 2. Web Speech API (Highest fidelity natural speech with pitch-preserved slow rate)
  const playWithWebSpeech = (): boolean => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        currentUtterance = utterance;
        utterance.lang = 'en-US';
        // Rate range 0.4x - 1.5x
        utterance.rate = Math.max(0.4, Math.min(1.5, rate));
        // Pitch strictly 1.0 (Normal natural human pitch, avoiding low pitch / monster voice)
        utterance.pitch = 1.0;

        const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find(
            (v) =>
              (v.lang === 'en-US' || v.lang.startsWith('en_US') || v.lang === 'en-GB' || v.lang.startsWith('en')) &&
              (v.name.includes('Natural') ||
                v.name.includes('Google') ||
                v.name.includes('Samantha') ||
                v.name.includes('Karen') ||
                v.name.includes('Daniel') ||
                v.name.includes('Alex') ||
                v.name.includes('Siri') ||
                v.default)
          ) || voices.find((v) => v.lang.startsWith('en'));

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          notifyStart();
        };
        utterance.onend = () => {
          notifyEnd();
        };
        utterance.onerror = (e) => {
          console.warn('[TTS] WebSpeech error:', e);
          notifyEnd();
        };

        window.speechSynthesis.speak(utterance);
        return true;
      } catch (e) {
        console.warn('[TTS] WebSpeech exception:', e);
        return false;
      }
    }
    return false;
  };

  // Try Web Speech API first for paragraphs or when speed is modified (maintains identical natural pitch)
  if (playWithWebSpeech()) {
    return;
  }

  // Audio Fallback Chain (for dictionary audio or browsers without Web Speech):
  // 1. Same-origin Server Proxy
  // 2. Youdao US Dictionary Voice
  // 3. Google Translate TTS
  const audioUrls = [
    getApiUrl(`/api/tts?text=${encodeURIComponent(cleanText.slice(0, 250))}`),
    `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanText.slice(0, 350))}&type=2`,
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText.slice(0, 200))}&tl=en&client=tw-ob`,
  ];

  // Try HTML5 Audio with preservesPitch enabled (avoids pitch drop)
  const playWithHtmlAudio = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        // Enforce pitch preservation on all browser engines
        audio.preservesPitch = true;
        (audio as any).mozPreservesPitch = true;
        (audio as any).webkitPreservesPitch = true;
        audio.playbackRate = Math.max(0.4, Math.min(2.0, rate));
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

  // Try Web Audio API decodeAudioData (only when rate === 1.0 since AudioBufferSourceNode lacks pitch preservation)
  const playWithWebAudio = async (url: string): Promise<boolean> => {
    if (rate !== 1.0) {
      // Avoid AudioBufferSourceNode when rate != 1.0 because it shifts pitch downwards
      return false;
    }
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
      source.playbackRate.value = 1.0;
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

  // Execution flow
  (async () => {
    for (const url of audioUrls) {
      // Try HTML5 Audio with preservesPitch first
      const htmlAudioOk = await playWithHtmlAudio(url);
      if (htmlAudioOk) return;

      // Try Web Audio API fallback (for normal 1.0x rate)
      const webAudioOk = await playWithWebAudio(url);
      if (webAudioOk) return;
    }

    notifyError();
  })();
};
