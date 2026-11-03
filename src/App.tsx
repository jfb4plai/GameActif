import { CalmProvider, CalmToggle } from './ui/CalmContext';

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
      <main />
    </CalmProvider>
  );
}
