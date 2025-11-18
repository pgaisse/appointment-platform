import { ReactNode } from 'react';
import LiquidTokenManager from './LiquidTokenManager';
import ModalShell from './ModalShell';

interface Props {
  trigger: ReactNode;
}

export default function LiquidTokenManagerModal({ trigger }: Props) {
  return (
    <ModalShell trigger={trigger} title="Manage Tokens" size="6xl">
      <LiquidTokenManager />
    </ModalShell>
  );
}
