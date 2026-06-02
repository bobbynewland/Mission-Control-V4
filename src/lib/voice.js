// Voice helpers: Web Speech API (STT) + audio playback for MiniMax TTS (Phase 1)

export const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const isSpeechRecognitionSupported = () => Boolean(getSpeechRecognition());

export const createRecognizer = ({ lang = 'en-US', interim = true } = {}) => {
  const SR = getSpeechRecognition();
  if (!SR) throw new Error('SpeechRecognition is not supported in this browser');
  const rec = new SR();
  rec.continuous = false;
  rec.interimResults = interim;
  rec.lang = lang;
  return rec;
};

export const requestMicPermission = async () => {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API not available');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Immediately release; SpeechRecognition manages its own stream.
  stream.getTracks().forEach((t) => t.stop());
  return true;
};

export const base64ToBlobUrl = (base64, mimeType = 'audio/mp3') => {
  const byteChars = atob(base64);
  const len = byteChars.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
};

export const playAudioFromBase64 = (base64, mimeType = 'audio/mp3') =>
  new Promise((resolve, reject) => {
    try {
      const url = base64ToBlobUrl(base64, mimeType);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      audio.play().catch(reject);
    } catch (e) {
      reject(e);
    }
  });

export const VOICE_OPTIONS = [
  { id: 'alpha', label: 'Alpha (default)' },
  { id: 'male-qn-qingse', label: 'American male' },
  { id: 'audiobook_female_1', label: 'British female' },
  { id: 'presenter_male', label: 'Presenter' },
];
