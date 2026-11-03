export default function App() {
  return (
    <>
      <header className="entete">
        <div className="rayons" aria-hidden="true" />
        <div className="soleil" aria-hidden="true" />
        <div className="contenu">
          <img src="plai-logo.jpg" alt="PLAI" style={{ height: '32px', width: 'auto' }} />
          <h1>GameActif</h1>
          <span className="etiquette">Maquette : aucune donnée enregistrée</span>
        </div>
      </header>
      <main />
    </>
  );
}
