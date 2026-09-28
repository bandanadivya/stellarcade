export interface TokenOption {
  code: string;
  name: string;
  issuer?: string;
  icon?: string;
  balance?: number | string;
  hasTrustline: boolean;
  minDeposit?: number;
  decimals?: number;
}

export interface MultiTokenDepositModalProps {
  isOpen: boolean;
  tokens: TokenOption[];
  depositAddress: string;
  onClose: () => void;
  onSelectToken?: (token: TokenOption) => void;
  memoId?: string;
  className?: string;
}
