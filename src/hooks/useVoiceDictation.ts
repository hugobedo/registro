import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function appendDictatedText(currentValue: string, spokenChunk: string): string {
  const cleanChunk = spokenChunk.trim();
  if (!cleanChunk) return currentValue;
  if (!currentValue.trim()) return cleanChunk;
  const needsSpace = !/\s$/.test(currentValue);
  return `${currentValue}${needsSpace ? ' ' : ''}${cleanChunk}`;
}

export function useVoiceDictation() {
  const [isSupported] = useState<boolean>(() => getSpeechRecognitionConstructor() !== null);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [interimText, setInterimText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const activeFieldRef = useRef<string | null>(null);
  const onAppendRef = useRef<((transcript: string) => void) | null>(null);

  const stopDictation = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors if already ended
      }
      recognitionRef.current = null;
    }
    activeFieldRef.current = null;
    onAppendRef.current = null;
    setActiveFieldId(null);
    setInterimText('');
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleDictation = useCallback(
    (fieldId: string, onAppend: (transcript: string) => void) => {
      if (!isSupported) {
        setStatusMessage(
          'Este navegador no es compatible con el dictado por voz. Puedes escribir manualmente sin afectar ninguna función.'
        );
        return;
      }

      // If clicking the same active field, stop (pause) cleanly
      if (activeFieldRef.current === fieldId && recognitionRef.current) {
        stopDictation();
        setStatusMessage(null);
        return;
      }

      // If another field was recording, stop it first
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }

      const Ctor = getSpeechRecognitionConstructor();
      if (!Ctor) {
        setStatusMessage(
          'Tu navegador no admite reconocimiento de voz. Puedes capturar la información manualmente.'
        );
        return;
      }

      try {
        const recognition = new Ctor();
        recognition.lang = 'es-MX';
        recognition.continuous = true;
        recognition.interimResults = true;

        activeFieldRef.current = fieldId;
        onAppendRef.current = onAppend;
        recognitionRef.current = recognition;
        setActiveFieldId(fieldId);
        setInterimText('');
        setStatusMessage(null);

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result[0]?.transcript || '';
            if (result.isFinal) {
              finalTranscript += text;
            } else {
              interimTranscript += text;
            }
          }

          if (finalTranscript.trim() && onAppendRef.current) {
            onAppendRef.current(finalTranscript.trim());
          }
          setInterimText(interimTranscript.trim());
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setStatusMessage(
              'Permiso de micrófono bloqueado. Activa el acceso al micrófono en tu navegador para dictar.'
            );
          } else if (event.error === 'audio-capture') {
            setStatusMessage('No se detectó un micrófono disponible en este dispositivo.');
          } else if (event.error === 'network') {
            setStatusMessage(
              'Error de red al transcribir la voz. Verifica tu conexión o escribe manualmente.'
            );
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setStatusMessage('No se pudo completar el dictado por voz. Intenta de nuevo.');
          }
          if (event.error !== 'no-speech') {
            activeFieldRef.current = null;
            onAppendRef.current = null;
            recognitionRef.current = null;
            setActiveFieldId(null);
            setInterimText('');
          }
        };

        recognition.onend = () => {
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
            activeFieldRef.current = null;
            onAppendRef.current = null;
            setActiveFieldId(null);
            setInterimText('');
          }
        };

        recognition.start();
      } catch {
        activeFieldRef.current = null;
        onAppendRef.current = null;
        recognitionRef.current = null;
        setActiveFieldId(null);
        setInterimText('');
        setStatusMessage(
          'No fue posible iniciar el micrófono en este dispositivo. Puedes escribir normalmente.'
        );
      }
    },
    [isSupported, stopDictation]
  );

  return {
    isSupported,
    activeFieldId,
    interimText,
    statusMessage,
    clearStatusMessage: () => setStatusMessage(null),
    toggleDictation,
    stopDictation,
  };
}
