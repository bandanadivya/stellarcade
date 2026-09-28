# Multi-Token Deposit Modal

An accessible Stellar asset deposit modal supporting multi-token asset selection (XLM, USDC, EURC, AQUA), balance lookups, trustline readiness indicators, copy-to-clipboard, QR code previews, and memo warnings.

> **Status:** experimental, self-contained component under `experimental/ui/`. It does not modify core `apps/web/` surfaces.

## Features

- **Multi-token selection:** Dropdown selector with token icons, asset codes, names, and user balances.
- **Trustline status checks:** Displays `Active` vs `Needs Trustline` badge with an explanatory warning banner when trustline is absent.
- **Address & QR code:** One-click copy with visual "Copied!" confirmation and an SVG QR code toggle.
- **Quick amount buttons:** Convenient amount increment buttons (+10, +50, +100, +500).
- **Network memo warning:** Explicit exchange deposit warning banner with destination Memo ID.
- **Accessible modal:** Focus trapping, ESC key dismissal, and backdrop click handling.

## Props

See `types.ts` for full definitions:

```typescript
export interface MultiTokenDepositModalProps {
  isOpen: boolean;
  tokens: TokenOption[];
  depositAddress: string;
  onClose: () => void;
  onSelectToken?: (token: TokenOption) => void;
  memoId?: string;
  className?: string;
}
```

## Installation

```bash
cd experimental/ui/multi-token-deposit-modal
npm install
```

## Testing

```bash
npm test
```
