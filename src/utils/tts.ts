let activeAudio: HTMLAudioElement | null = null;

export const stopSpeech = () => {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
};

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

  // Function to fallback to server-side HTML5 Audio TTS (Works 100% in Android WebView/APK)
  const fallbackToServerTts = () => {
    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}`;
      const audio = new Audio(audioUrl);
      activeAudio = audio;

      audio.onplay = () => {
        hasStarted = true;
        onStart?.();
      };

      audio.onended = () => {
        if (activeAudio === audio) activeAudio = null;
        onEnd?.();
      };

      audio.onerror = () => {
        if (activeAudio === audio) activeAudio = null;
        onError?.();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[TTS Audio] Playback prevented by webview gesture restriction:', err);
          if (activeAudio === audio) activeAudio = null;
          onError?.();
        });
      }
    } catch (err) {
      console.error('[TTS Audio] HTML5 Audio creation failed:', err);
      onError?.();
    }
  };

  // Check if WebSpeech API is supported and has voices
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;

      utterance.onstart = () => {
        hasStarted = true;
        onStart?.();
      };

      utterance.onend = () => {
        onEnd?.();
      };

      utterance.onerror = (e) => {
        console.warn('[WebSpeech] Utterance error, switching to server TTS:', e);
        if (!hasStarted) {
          fallbackToServerTts();
        } else {
          onError?.();
        }
      };

      window.speechSynthesis.speak(utterance);

      // Safety check for Android WebView where speechSynthesis.speak() silently freezes/does nothing:
      setTimeout(() => {
        if (!hasStarted) {
          try {
            window.speechSynthesis.cancel();
          } catch (e) {}
          fallbackToServerTts();
        }
      }, 350);

      return;
    } catch (e) {
      console.warn('[WebSpeech] Exception, falling back to server TTS:', e);
    }
  }

  // Direct server fallback
  fallbackToServerTts();
};
