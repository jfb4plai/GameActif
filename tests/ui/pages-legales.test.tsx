// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PageLegale } from '../../src/ui/PageLegale';
import { PiedDePage } from '../../src/ui/PiedDePage';

afterEach(() => cleanup());

const texte = () => document.body.textContent ?? '';

describe('PageLegale, confidentialité', () => {
  it('sans compte ni suivi : tout reste dans le navigateur et aucune donnée d’élève n’est enregistrée', () => {
    render(<PageLegale page="confidentialite" compteActif={false} suiviActif={false} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Confidentialité' })).toBeTruthy();
    expect(texte()).toMatch(/stockage local de votre navigateur/);
    expect(texte()).toMatch(/aucune donnée d’élève n’est enregistrée/);
    expect(texte()).not.toMatch(/adresse e-mail/);
    expect(texte()).not.toMatch(/E01/);
  });

  it('avec un compte enseignant : l’adresse e-mail et les activités enregistrées sont citées', () => {
    render(<PageLegale page="confidentialite" compteActif suiviActif={false} />);
    expect(texte()).toMatch(/adresse e-mail/);
    expect(texte()).toMatch(/activités enregistrées/);
    expect(texte()).toMatch(/aucune donnée d’élève n’est enregistrée/);
  });

  it('avec le suivi ouvert : résultats sous code pseudonyme, prénoms locaux, observations, partage, suppression au 30 août', () => {
    render(<PageLegale page="confidentialite" compteActif suiviActif />);
    expect(texte()).toMatch(/E01/);
    expect(texte()).toMatch(/pseudonyme/);
    expect(texte()).toMatch(/prénoms ne quittent jamais l’appareil/);
    expect(texte()).toMatch(/30 août/);
    expect(texte()).toMatch(/observations/);
    expect(texte()).toMatch(/activité partagée/);
    expect(texte()).toMatch(/niveau/);
    expect(texte()).not.toMatch(/aucune donnée d’élève n’est enregistrée/);
  });

  it('avec le suivi ouvert : les responsables, l’effacement au plus tard le 30 août et le rappel « ni prénom ni nom »', () => {
    render(<PageLegale page="confidentialite" compteActif suiviActif />);
    expect(texte()).toMatch(/Responsables : l’administrateur de l’application \(Jean-François Beguin\) et l’enseignant qui l’utilise avec sa classe/);
    expect(texte()).toMatch(/L’enseignant est responsable des données qu’il détient sur ses élèves/);
    expect(texte()).toMatch(/au plus tard le 30 août/);
    expect(texte()).toMatch(/ne jamais écrire de prénom ni de nom d’élève/);
  });

  it('sans le suivi, la page ne parle pas de responsables de données d’élèves', () => {
    render(<PageLegale page="confidentialite" compteActif suiviActif={false} />);
    expect(texte()).not.toMatch(/Responsables :/);
  });

  it('le suivi seul (sans compte déclaré) ne promet pas l’absence de donnée d’élève', () => {
    render(<PageLegale page="confidentialite" compteActif={false} suiviActif />);
    expect(texte()).not.toMatch(/aucune donnée d’élève n’est enregistrée/);
  });

  it('dit la vérité sur l’IA : l’application n’en appelle aucune', () => {
    render(<PageLegale page="confidentialite" compteActif={false} suiviActif={false} />);
    expect(texte()).toMatch(/n’appelle aucun service d’intelligence artificielle/);
  });

  it('donne le contact des outils PLAI, jamais l’autre adresse, et aucun tiret cadratin', () => {
    for (const [c, s] of [[false, false], [true, false], [true, true]] as const) {
      cleanup();
      render(<PageLegale page="confidentialite" compteActif={c} suiviActif={s} />);
      expect(texte()).toMatch(/jeanfrancois\.beguin@ens\.ecl\.be/);
      expect(texte()).not.toMatch(/jf\.beguin@outlook\.com/);
      expect(texte()).not.toMatch(/—/);
    }
  });

  it('ne prétend pas connaître la localisation de l’hébergement', () => {
    render(<PageLegale page="confidentialite" compteActif={false} suiviActif={false} />);
    expect(texte()).toMatch(/localisation : à confirmer/);
  });

  it('ne promet rien de ce qui n’est pas établi : ni « conforme », ni « sécurisé »', () => {
    render(<PageLegale page="confidentialite" compteActif suiviActif />);
    expect(texte()).not.toMatch(/conforme|sécurisé|garanti/i);
  });
});

describe('PageLegale, mentions', () => {
  it('nomme l’éditeur, le contact, la licence et la source des attendus', () => {
    render(<PageLegale page="mentions" compteActif={false} suiviActif={false} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Mentions légales' })).toBeTruthy();
    expect(texte()).toMatch(/Jean-François Beguin/);
    expect(texte()).toMatch(/Pôle Territorial de la Ville de Liège/);
    expect(texte()).toMatch(/jeanfrancois\.beguin@ens\.ecl\.be/);
    // Aucun fichier LICENSE dans le dépôt GameActif (git ls-files, origin/main) : la page ne revendique aucune licence.
    expect(texte()).toMatch(/Licence du code : à préciser/);
    expect(texte()).not.toMatch(/PolyForm/);
    expect(texte()).toMatch(/Fédération Wallonie-Bruxelles/);
    expect(texte()).not.toMatch(/—/);
  });
});

describe('PiedDePage', () => {
  it('donne accès aux deux pages et au retour au parcours', () => {
    render(<PiedDePage />);
    expect((screen.getByRole('link', { name: 'Confidentialité' }) as HTMLAnchorElement).getAttribute('href')).toBe('#/confidentialite');
    expect((screen.getByRole('link', { name: 'Mentions légales' }) as HTMLAnchorElement).getAttribute('href')).toBe('#/mentions');
    expect((screen.getByRole('link', { name: 'Retour au parcours' }) as HTMLAnchorElement).getAttribute('href')).toBe('#/');
  });
});
