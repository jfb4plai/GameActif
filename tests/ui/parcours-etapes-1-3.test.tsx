// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { EtapeNiveau } from '../../src/ui/EtapeNiveau';
import { EtapeMatiere } from '../../src/ui/EtapeMatiere';
import { EtapeCompetences } from '../../src/ui/EtapeCompetences';
import { etatInitial, reduire, type EtatParcours, type Evenement } from '../../src/parcours/etapes.js';

afterEach(() => cleanup());

const aveC = (niveau: string, matiere = '', cibles: string[] = []): EtatParcours => {
  const e = etatInitial();
  return { ...e, brouillon: { ...e.brouillon, niveau, matiere, cibles } };
};

function Harnais({ depart }: { depart: EtatParcours }) {
  const [etat, envoyer] = useReducer(reduire, depart);
  return <EtapeCompetences etat={etat} envoyer={envoyer} />;
}

describe('EtapeNiveau', () => {
  it('propose un bouton par niveau de P1 à P6', () => {
    render(<EtapeNiveau etat={etatInitial()} envoyer={() => {}} />);
    const noms = screen.getAllByRole('button').map((b) => b.textContent);
    expect(noms).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
  });

  it('cliquer P5 envoie le choix et le niveau choisi est marqué', async () => {
    const envoyer = vi.fn();
    const { rerender } = render(<EtapeNiveau etat={etatInitial()} envoyer={envoyer} />);
    await userEvent.click(screen.getByRole('button', { name: 'P5' }));
    expect(envoyer).toHaveBeenCalledWith({ type: 'choisirNiveau', niveau: 'P5' } satisfies Evenement);
    rerender(<EtapeNiveau etat={aveC('P5')} envoyer={envoyer} />);
    expect(screen.getByRole('button', { name: 'P5' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'P4' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('EtapeMatiere', () => {
  it('propose les mathématiques pour P5 et envoie le choix', async () => {
    const envoyer = vi.fn();
    render(<EtapeMatiere etat={aveC('P5')} envoyer={envoyer} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mathématiques' }));
    expect(envoyer).toHaveBeenCalledWith({ type: 'choisirMatiere', matiere: 'mathematiques' });
  });

  it('propose les mathématiques et le français pour P3 et envoie le choix du français', async () => {
    const envoyer = vi.fn();
    render(<EtapeMatiere etat={aveC('P3')} envoyer={envoyer} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Mathématiques', 'Français']);
    await userEvent.click(screen.getByRole('button', { name: 'Français' }));
    expect(envoyer).toHaveBeenCalledWith({ type: 'choisirMatiere', matiere: 'francais' });
  });

  it('dit qu’aucune matière n’est disponible quand le niveau n’en a pas', () => {
    render(<EtapeMatiere etat={aveC('S1')} envoyer={() => {}} />);
    expect(screen.getByText('Aucune matière n’est encore disponible pour ce niveau.')).toBeTruthy();
  });
});

describe('EtapeCompetences, français', () => {
  it('affiche les 10 rubriques de P3 et des codes F.P3.', () => {
    render(<Harnais depart={aveC('P3', 'francais')} />);
    expect(document.querySelectorAll('details.groupe-competences')).toHaveLength(10);
    expect(screen.getByText('F.P3.r1.i1.a1')).toBeTruthy();
  });
});

describe('EtapeCompetences', () => {
  it('affiche les 11 groupes de P4 avec le texte officiel d’un attendu', () => {
    render(<Harnais depart={aveC('P4', 'mathematiques')} />);
    expect(document.querySelectorAll('details.groupe-competences')).toHaveLength(11);
    expect(screen.getAllByText(/Utiliser le vocabulaire exprimant des positions relatives/).length).toBeGreaterThan(0);
    expect(screen.getByText('M.P4.1.1.i1.a2')).toBeTruthy();
  });

  it('le quatrième attendu coché est refusé, les trois premiers restent cochés (Review Focus 5)', async () => {
    render(<Harnais depart={aveC('P4', 'mathematiques')} />);
    const case_ = (code: string) => screen.getByRole('checkbox', { name: new RegExp(code.replace(/\./g, '\\.')) }) as HTMLInputElement;
    for (const c of ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3']) await userEvent.click(case_(c));
    expect(screen.getByText('3 sur 3')).toBeTruthy();
    await userEvent.click(case_('M.P4.1.1.i2.a1'));
    expect(case_('M.P4.1.1.i2.a1').checked).toBe(false);
    for (const c of ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3']) expect(case_(c).checked).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Trois compétences au maximum : décochez-en une avant d’en choisir une autre.');
  });

  it('décocher un attendu libère une place', async () => {
    render(<Harnais depart={aveC('P4', 'mathematiques', ['M.P4.1.1.i1.a1'])} />);
    expect(screen.getByText('1 sur 3')).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: /M\.P4\.1\.1\.i1\.a1/ }));
    expect(screen.getByText('0 sur 3')).toBeTruthy();
  });

  it('la recherche ne laisse que le groupe qui correspond', async () => {
    render(<Harnais depart={aveC('P4', 'mathematiques')} />);
    await userEvent.type(screen.getByLabelText('Chercher dans les compétences'), 'positions relatives');
    const groupes = document.querySelectorAll('details.groupe-competences');
    expect(groupes).toHaveLength(1);
    expect(within(groupes[0] as HTMLElement).getByText('M.P4.1.1.i1.a2')).toBeTruthy();
  });

  it('une recherche sans résultat le dit', async () => {
    render(<Harnais depart={aveC('P4', 'mathematiques')} />);
    await userEvent.type(screen.getByLabelText('Chercher dans les compétences'), 'zzzz');
    expect(screen.getByText('Aucune compétence ne correspond à cette recherche.')).toBeTruthy();
  });

  it('le champ de recherche a un label, un placeholder et un texte d’aide relié', () => {
    render(<Harnais depart={aveC('P4', 'mathematiques')} />);
    const champ = screen.getByLabelText('Chercher dans les compétences') as HTMLInputElement;
    expect(champ.placeholder).toBe('Exemple : fractions, déplacer, ordre');
    const aide = document.getElementById(champ.getAttribute('aria-describedby') as string) as HTMLElement;
    expect(aide.textContent).toContain('texte officiel');
  });

  it('dit ce que les jeux savent faire et ne pas faire', () => {
    render(<Harnais depart={aveC('P4', 'mathematiques')} />);
    expect(screen.getByText(/classer, relier et ordonner/)).toBeTruthy();
    expect(screen.getByText(/tracer, mesurer ou construire/)).toBeTruthy();
  });

  it('chaque attendu affiche son type', () => {
    render(<Harnais depart={aveC('P4', 'mathematiques')} />);
    expect(screen.getAllByText('Savoir').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Savoir-faire').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Compétence').length).toBeGreaterThan(0);
  });
});
