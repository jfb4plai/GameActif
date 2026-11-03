import { CalmProvider, CalmToggle } from './ui/CalmContext';
import { ActivityScreen } from './ui/ActivityScreen';
import { activitePilote } from './data/pilote';

// Créée une seule fois : l'activité d'exemple ne change pas pendant la session.
const ACTIVITE = activitePilote();

export default function App() {
  return (
    <CalmProvider>
      <header className="entete">
        <div className="rayons" aria-hidden="true" />
        <div className="soleil" aria-hidden="true" />
        <div className="contenu">
          <img src="plai-logo.jpg" alt="PLAI" style={{ height: '32px', width: 'auto' }} />
          <h1>GameActif</h1>
          <span className="etiquette">Maquette : aucune donnée enregistrée</span>
          <CalmToggle />
        </div>
      </header>
      <main>
        <ActivityScreen activity={ACTIVITE} />
      </main>
    </CalmProvider>
  );
}
