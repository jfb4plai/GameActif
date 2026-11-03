import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface CalmState {
  calm: boolean;
  setCalm: (on: boolean) => void;
}

const CalmContext = createContext<CalmState>({ calm: false, setCalm: () => {} });

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Mode calme : activé au départ quand le système demande moins d'animations ; jamais de son. */
export function CalmProvider({ children }: { children: ReactNode }) {
  const [calm, setCalm] = useState<boolean>(prefersReducedMotion);

  useEffect(() => {
    document.body.classList.toggle('calme', calm);
    return () => document.body.classList.remove('calme');
  }, [calm]);

  const value = useMemo(() => ({ calm, setCalm }), [calm]);
  return <CalmContext.Provider value={value}>{children}</CalmContext.Provider>;
}

export function useCalm(): CalmState {
  return useContext(CalmContext);
}

export function CalmToggle() {
  const { calm, setCalm } = useCalm();
  return (
    <button type="button" aria-pressed={calm} onClick={() => setCalm(!calm)}>
      {`Mode calme : ${calm ? 'activé' : 'désactivé'}`}
    </button>
  );
}
