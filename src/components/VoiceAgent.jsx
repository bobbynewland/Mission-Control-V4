import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Play, Settings as SettingsIcon, ArrowLeft, Volume2 } from 'lucide-react';
import {
  VOICE_OPTIONS,
  createRecognizer,
  isSpeechRecognitionSupported,
  requestMicPermission,
  base64ToBlobUrl,
} from '../lib/voice';

const STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
};

const STATE_LABEL = {
  idle: 'TAP TO TALK',
  listening: 'LISTENING...',
  thinking: 'THINKING...',
  speaking: 'SPEAKING...',
};

const STATE_RING = {
  idle: 'from-white/10 to-white/5 border-white/20 text-white/80',
  listening: 'from-red-500/30 to-red-700/20 border-red-400/60 text-red-200',
  thinking: 'from-gold/30 to-gold/10 border-gold/60 text-gold',
  speaking: 'from-purple/40 to-purple/10 border-purple/60 text-purple-200',
};

const Waveform = ({ color = '#fff', bars = 5 }) => (
  <div className="flex items-end gap-1 h-6">
    {Array.from({ length: bars }).map((_, i) => (
      <motion.span
        key={i}
        className="block w-1 rounded-full"
        style={{ backgroundColor: color }}
        animate={{ height: ['25%', '95%', '40%', '80%', '30%'] }}
        transition={{
          duration: 0.9,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: i * 0.08,
        }}
      />
    ))}
  </div>
);

const VoiceAgent = () => {
  const [state, setState] = useState(STATES.IDLE);
  const [voice, setVoice] = useState(VOICE_OPTIONS[0].id);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [supported] = useState(isSpeechRecognitionSupported());

  const recognizerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const transcriptRef = useRef('');
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, interim]);

  const cleanupRecognizer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognizerRef.current) {
      try { recognizerRef.current.onend = null; recognizerRef.current.stop(); } catch (e) { /* noop */ }
      recognizerRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanupRecognizer(), [cleanupRecognizer]);

  const sendToBackend = useCallback(async (finalText) => {
    setState(STATES.THINKING);
    setMessages((prev) => [...prev, { role: 'user', text: finalText }]);
    setInterim('');
    setTranscript('');
    transcriptRef.current = '';

    try {
      const r = await fetch('/api/voice-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: finalText,
          voice,
          history: messages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
        }),
      });
      const data = await r.json();
      if (!data?.ok) throw new Error(data?.error || 'voice-chat failed');

      const assistantMsg = {
        role: 'assistant',
        text: data.text,
        audioUrl: data.audioBase64
          ? base64ToBlobUrl(data.audioBase64, data.audioMimeType || 'audio/mp3')
          : null,
        ttsError: data.ttsError || null,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (assistantMsg.audioUrl) {
        setState(STATES.SPEAKING);
        const audio = new Audio(assistantMsg.audioUrl);
        audio.onended = () => setState(STATES.IDLE);
        audio.onerror = () => setState(STATES.IDLE);
        try { await audio.play(); } catch (e) { setState(STATES.IDLE); }
      } else {
        setState(STATES.IDLE);
      }
    } catch (e) {
      setError(String(e?.message || e));
      setState(STATES.IDLE);
    }
  }, [voice, messages]);

  const stopListening = useCallback(() => {
    const final = (transcriptRef.current || '').trim();
    cleanupRecognizer();
    if (final) {
      sendToBackend(final);
    } else {
      setInterim('');
      setState(STATES.IDLE);
    }
  }, [cleanupRecognizer, sendToBackend]);

  const startListening = useCallback(async () => {
    setError('');
    if (!supported) {
      setError('Speech recognition is not supported in this browser. Try Chrome.');
      return;
    }
    try {
      await requestMicPermission();
    } catch (e) {
      setError(`Mic permission denied: ${e?.message || e}`);
      return;
    }

    let rec;
    try {
      rec = createRecognizer({ lang: 'en-US', interim: true });
    } catch (e) {
      setError(String(e?.message || e));
      return;
    }
    recognizerRef.current = rec;
    transcriptRef.current = '';
    setTranscript('');
    setInterim('');

    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        try { rec.stop(); } catch (e) { /* noop */ }
      }, 2000);
    };

    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) {
        transcriptRef.current = (transcriptRef.current + ' ' + finalText).trim();
        setTranscript(transcriptRef.current);
      }
      setInterim(interimText);
      resetSilenceTimer();
    };

    rec.onerror = (e) => {
      setError(`Recognition error: ${e?.error || 'unknown'}`);
    };

    rec.onend = () => {
      stopListening();
    };

    try {
      rec.start();
      setState(STATES.LISTENING);
      resetSilenceTimer();
    } catch (e) {
      setError(String(e?.message || e));
      cleanupRecognizer();
      setState(STATES.IDLE);
    }
  }, [supported, cleanupRecognizer, stopListening]);

  const onTapButton = useCallback(() => {
    if (state === STATES.IDLE) startListening();
    else if (state === STATES.LISTENING) {
      try { recognizerRef.current?.stop(); } catch (e) { stopListening(); }
    }
  }, [state, startListening, stopListening]);

  const replayAudio = (url) => {
    if (!url) return;
    const a = new Audio(url);
    setState(STATES.SPEAKING);
    a.onended = () => setState(STATES.IDLE);
    a.onerror = () => setState(STATES.IDLE);
    a.play().catch(() => setState(STATES.IDLE));
  };

  const buttonRing = STATE_RING[state];

  const liveStatus = useMemo(() => {
    if (error) return error;
    if (state === STATES.LISTENING) return interim ? `"${interim}"` : 'Listening...';
    if (state === STATES.THINKING) return 'Thinking...';
    if (state === STATES.SPEAKING) return 'Speaking...';
    return 'Ready';
  }, [state, interim, error]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#050505] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white/70">
          <Volume2 size={18} className="text-gold" />
          <span className="text-sm font-bold uppercase tracking-wider">Voice Agent</span>
          <span className="text-[10px] font-mono text-white/30 ml-2">PHASE 1</span>
        </div>
        <button
          className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          title="Settings (coming soon)"
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      {/* Conversation log */}
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-center text-white/30 text-sm py-12">
            <Mic className="mx-auto mb-3 text-white/20" size={36} />
            <p className="font-mono uppercase tracking-widest text-[10px]">
              Tap the mic to start a conversation
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 backdrop-blur-xl border ${
                m.role === 'user'
                  ? 'bg-gold/10 border-gold/30 text-white'
                  : 'bg-white/5 border-white/10 text-white/90'
              }`}
            >
              <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1">
                {m.role === 'user' ? 'You' : 'Hermes'}
              </div>
              <div className="text-sm leading-relaxed">{m.text}</div>
              {m.role === 'assistant' && m.audioUrl && (
                <button
                  onClick={() => replayAudio(m.audioUrl)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-gold transition-colors"
                >
                  <Play size={12} /> Play
                </button>
              )}
              {m.role === 'assistant' && m.ttsError && (
                <div className="mt-1 text-[10px] text-red-300/70 font-mono">
                  TTS unavailable: {m.ttsError}
                </div>
              )}
            </div>
          </div>
        ))}

        {state === STATES.LISTENING && interim && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gold/5 border border-gold/20 text-white/60 italic">
              {interim}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-4 border-t border-white/10 bg-[#050505]/95 backdrop-blur-xl pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-white/40">Voice</span>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-gold/50"
              disabled={state !== STATES.IDLE}
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#0a0a0a]">
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-white/40 truncate max-w-[55%] text-right">
            {liveStatus}
          </div>
        </div>

        <div className="flex justify-center">
          <motion.button
            onClick={onTapButton}
            disabled={state === STATES.THINKING || state === STATES.SPEAKING}
            whileTap={{ scale: 0.96 }}
            className={`relative w-[200px] h-[200px] rounded-full border-2 bg-gradient-to-br ${buttonRing} flex flex-col items-center justify-center font-black uppercase tracking-wider shadow-2xl backdrop-blur-xl transition-colors disabled:opacity-70`}
          >
            <AnimatePresence>
              {state === STATES.LISTENING && (
                <motion.div
                  key="pulse"
                  className="absolute inset-0 rounded-full border-2 border-red-400/60"
                  initial={{ scale: 1, opacity: 0.7 }}
                  animate={{ scale: 1.35, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              {state === STATES.SPEAKING && (
                <motion.div
                  key="pulse-p"
                  className="absolute inset-0 rounded-full border-2 border-purple/60"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 1.3, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
            </AnimatePresence>

            {state === STATES.LISTENING ? (
              <Waveform color="#fca5a5" />
            ) : state === STATES.SPEAKING ? (
              <Waveform color="#d8b4fe" />
            ) : (
              <Mic size={42} className="mb-1" />
            )}
            <span className="mt-2 text-xs">{STATE_LABEL[state]}</span>
          </motion.button>
        </div>

        {!supported && (
          <p className="mt-3 text-center text-[11px] text-red-300/80">
            Browser does not support speech recognition. Try Chrome or Edge.
          </p>
        )}
      </div>
    </div>
  );
};

export default VoiceAgent;
