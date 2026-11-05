import type { ComponentType } from 'react';
import type { MechanicId, ProfileId } from '../engine/types.js';
import type { ElementResult, RoundState } from '../engine/round.js';
import { ComparerBoard } from './ComparerBoard.js';
import { MemoBoard } from './MemoBoard.js';
import { QcmBoard } from './QcmBoard.js';
import { RoundBoard } from './RoundBoard.js';
import { SceneBoard } from './SceneBoard.js';

export interface PlateauProps {
  round: RoundState;
  profile: ProfileId;
  onDone: (results: ElementResult[]) => void;
}

/** Le plateau de chaque mécanique. `Record<MechanicId, …>` : TypeScript refuse une mécanique sans plateau. */
export const PLATEAUX: Record<MechanicId, ComponentType<PlateauProps>> = {
  trier: ({ round, onDone }) => <RoundBoard round={round} onDone={onDone} />,
  associer: ({ round, onDone }) => <RoundBoard round={round} onDone={onDone} />,
  ordre: ({ round, onDone }) => <RoundBoard round={round} onDone={onDone} />,
  placer: ({ round, profile, onDone }) => <SceneBoard round={round} profile={profile} onDone={onDone} />,
  comparer: ({ round, onDone }) => <ComparerBoard round={round} onDone={onDone} />,
  memo: ({ round, onDone }) => <MemoBoard round={round} onDone={onDone} />,
  qcm: ({ round, onDone }) => <QcmBoard round={round} onDone={onDone} />,
};
