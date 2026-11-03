import { useCallback } from 'react';

/**
 * Lecture à voix haute par la synthèse vocale du navigateur. Voix fr-BE si elle existe, sinon la première
 * voix française ; sans synthèse, `available` est faux et `speak` ne fait rien.
 */
export function useSpeech(): { available: boolean; speak: (text: string) => void } {
  const available = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback(
    (text: string) => {
      if (!available) return;
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      const voice = voices.find((v) => /^fr-BE/i.test(v.lang)) ?? voices.find((v) => /^fr/i.test(v.lang));
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-BE';
      if (voice) utterance.voice = voice;
      synth.cancel();
      synth.speak(utterance);
    },
    [available],
  );

  return { available, speak };
}
