/** Pied de page : accès aux pages légales et retour au parcours. Les liens sont des ancres (`#/...`), sans rechargement. */
export function PiedDePage() {
  return (
    <footer className="pied-de-page">
      <nav aria-label="Informations légales">
        <a href="#/confidentialite">Confidentialité</a>
        {' · '}
        <a href="#/mentions">Mentions légales</a>
        {' · '}
        <a href="#/">Retour au parcours</a>
      </nav>
    </footer>
  );
}
