import { useEffect, useState } from 'react';

export type Vue = 'parcours' | 'confidentialite' | 'mentions';

/** Vue demandée par l'adresse : seuls `#/confidentialite` et `#/mentions` sont reconnus, tout le reste est le parcours. */
export function vueDepuisHash(hash: string): Vue {
  if (hash === '#/confidentialite') return 'confidentialite';
  if (hash === '#/mentions') return 'mentions';
  return 'parcours';
}

/** Vue courante, mise à jour quand l'adresse change (liens du pied de page, retour du navigateur). */
export function useVue(): Vue {
  const [vue, setVue] = useState<Vue>(() => (typeof window === 'undefined' ? 'parcours' : vueDepuisHash(window.location.hash)));
  useEffect(() => {
    const maj = () => setVue(vueDepuisHash(window.location.hash));
    window.addEventListener('hashchange', maj);
    return () => window.removeEventListener('hashchange', maj);
  }, []);
  return vue;
}
