import { CalmProvider, CalmToggle } from './ui/CalmContext';
import { AuthProvider, useAuthOptionnel } from './compte/auth';
import { Parcours } from './ui/Parcours';
import { PageLegale } from './ui/PageLegale';
import { PiedDePage } from './ui/PiedDePage';
import { useVue } from './ui/vue';
import { SUIVI_ACTIF_PAR_DEFAUT } from './suivi/interrupteur';

function Cadre() {
  const vue = useVue();
  const compteActif = useAuthOptionnel()?.disponible === true;
  return (
    <>
      <header className="entete">
        <div className="rayons" aria-hidden="true" />
        <div className="soleil" aria-hidden="true" />
        <div className="contenu">
          <img src="plai-logo.jpg" alt="PLAI" style={{ height: '32px', width: 'auto' }} />
          <h1>GameActif</h1>
          {/* L'étiquette n'est vraie que sans compte possible : avec un compte, des activités peuvent être enregistrées. */}
          {!compteActif && <span className="etiquette">Maquette : aucune donnée enregistrée</span>}
          <CalmToggle />
        </div>
      </header>
      <main>{vue === 'parcours' ? <Parcours /> : <PageLegale page={vue} compteActif={compteActif} suiviActif={SUIVI_ACTIF_PAR_DEFAUT} />}</main>
      <PiedDePage />
    </>
  );
}

export default function App() {
  return (
    <CalmProvider>
      <AuthProvider>
        <Cadre />
      </AuthProvider>
    </CalmProvider>
  );
}
