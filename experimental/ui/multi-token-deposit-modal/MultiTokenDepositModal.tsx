'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MultiTokenDepositModalProps, TokenOption } from './types';
import './MultiTokenDepositModal.css';

const QUICK_AMOUNTS = [10, 50, 100, 500];

export const MultiTokenDepositModal: React.FC<MultiTokenDepositModalProps> = ({
  isOpen,
  tokens = [],
  depositAddress,
  onClose,
  onSelectToken,
  memoId,
  className = '',
}) => {
  const [selectedTokenCode, setSelectedTokenCode] = useState<string>(
    tokens[0]?.code || 'XLM'
  );
  const [amount, setAmount] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  // Sync selected token when tokens change or modal opens
  useEffect(() => {
    if (tokens.length > 0 && !tokens.some((t) => t.code === selectedTokenCode)) {
      setSelectedTokenCode(tokens[0].code);
    }
  }, [tokens, selectedTokenCode]);

  // Escape key and focus trapping
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement;

    // Focus the dialog on open
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const elements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (elements.length === 0) return;

        const first = elements[0];
        const last = elements[elements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentToken =
    tokens.find((t) => t.code === selectedTokenCode) ||
    tokens[0] || {
      code: 'XLM',
      name: 'Stellar Lumens',
      hasTrustline: true,
      balance: 0,
    };

  const isNative = currentToken.code === 'XLM';
  const isTrustlineActive = isNative || currentToken.hasTrustline;

  const handleTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedTokenCode(code);
    const token = tokens.find((t) => t.code === code);
    if (token && onSelectToken) {
      onSelectToken(token);
    }
  };

  const handleCopyAddress = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(depositAddress);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
  };

  return (
    <div
      className="multi-deposit-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="multi-deposit-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="multi-deposit-title"
        className={`multi-deposit-dialog ${className}`.trim()}
      >
        <div className="multi-deposit-header">
          <h2 id="multi-deposit-title" className="multi-deposit-title">
            <span>Deposit Assets</span>
          </h2>
          <button
            type="button"
            className="multi-deposit-close-btn"
            onClick={onClose}
            aria-label="Close deposit modal"
          >
            &times;
          </button>
        </div>

        <div className="multi-deposit-body">
          {/* Memo warning banner */}
          <div className="multi-deposit-memo-alert" role="alert">
            <span className="multi-deposit-memo-title">
              ⚠️ Network Memo Requirement
            </span>
            <span>
              Transactions from exchanges (Binance, Coinbase, Kraken) require a destination Memo.
              {memoId ? ` Your Memo ID is: ${memoId}` : ' Unmemoed exchange deposits cannot be credited automatically.'}
            </span>
          </div>

          {/* Token selector */}
          <div className="multi-deposit-section">
            <label htmlFor="token-selector" className="multi-deposit-label">
              <span>Select Token</span>
              {currentToken.balance !== undefined && (
                <span className="multi-deposit-balance">
                  Balance: {currentToken.balance} {currentToken.code}
                </span>
              )}
            </label>
            <div className="multi-deposit-select-wrapper">
              <select
                id="token-selector"
                className="multi-deposit-select"
                value={selectedTokenCode}
                onChange={handleTokenChange}
                aria-label="Select deposit asset"
              >
                {tokens.map((token) => (
                  <option key={token.code} value={token.code}>
                    {token.code} - {token.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Token details and trustline badge */}
            <div className="multi-deposit-token-summary">
              <div className="multi-deposit-token-meta">
                <div className="multi-deposit-token-icon">
                  {currentToken.icon ? (
                    <img
                      src={currentToken.icon}
                      alt={currentToken.code}
                      style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                    />
                  ) : (
                    currentToken.code.slice(0, 3)
                  )}
                </div>
                <div className="multi-deposit-token-details">
                  <span className="multi-deposit-token-code">{currentToken.code}</span>
                  <span className="multi-deposit-token-name">{currentToken.name}</span>
                </div>
              </div>

              <span
                className={`multi-deposit-trustline-badge ${
                  isTrustlineActive ? 'trustline-active' : 'trustline-needed'
                }`}
                data-testid="trustline-badge"
              >
                {isTrustlineActive ? 'Active' : 'Needs Trustline'}
              </span>
            </div>

            {/* Trustline alert if missing */}
            {!isTrustlineActive && (
              <div
                className="multi-deposit-trustline-alert"
                data-testid="trustline-warning"
              >
                ⚠️ Warning: Your wallet does not currently have a trustline established for{' '}
                <strong>{currentToken.code}</strong>. You must establish a trustline in your wallet
                before depositing this asset, or the transfer will fail.
              </div>
            )}
          </div>

          {/* Deposit address */}
          <div className="multi-deposit-section">
            <label className="multi-deposit-label">Deposit Address</label>
            <div className="multi-deposit-address-card">
              <span className="multi-deposit-address-text" data-testid="deposit-address">
                {depositAddress}
              </span>
              <div className="multi-deposit-address-actions">
                <button
                  type="button"
                  className={`multi-deposit-btn-subtle ${copied ? 'copied' : ''}`}
                  onClick={handleCopyAddress}
                  aria-label="Copy deposit address"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="multi-deposit-btn-subtle"
                  onClick={() => setShowQr((prev) => !prev)}
                  aria-label="Toggle QR code"
                >
                  {showQr ? 'Hide QR' : 'Show QR'}
                </button>
              </div>
            </div>

            {/* QR code container */}
            {showQr && (
              <div className="multi-deposit-qr-container" data-testid="qr-code-preview">
                <svg
                  width="140"
                  height="140"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="QR Code preview"
                >
                  {/* Stylized QR mockup */}
                  <rect width="100" height="100" fill="#ffffff" />
                  <rect x="10" y="10" width="25" height="25" fill="#000000" />
                  <rect x="15" y="15" width="15" height="15" fill="#ffffff" />
                  <rect x="18" y="18" width="9" height="9" fill="#000000" />

                  <rect x="65" y="10" width="25" height="25" fill="#000000" />
                  <rect x="70" y="15" width="15" height="15" fill="#ffffff" />
                  <rect x="73" y="18" width="9" height="9" fill="#000000" />

                  <rect x="10" y="65" width="25" height="25" fill="#000000" />
                  <rect x="15" y="70" width="15" height="15" fill="#ffffff" />
                  <rect x="18" y="73" width="9" height="9" fill="#000000" />

                  <rect x="45" y="15" width="8" height="8" fill="#000000" />
                  <rect x="45" y="30" width="8" height="12" fill="#000000" />
                  <rect x="45" y="50" width="15" height="8" fill="#000000" />
                  <rect x="65" y="45" width="10" height="10" fill="#000000" />
                  <rect x="80" y="55" width="10" height="15" fill="#000000" />
                  <rect x="45" y="75" width="20" height="8" fill="#000000" />
                  <rect x="75" y="75" width="15" height="15" fill="#000000" />
                </svg>
                <div className="multi-deposit-qr-caption">Scan to deposit {currentToken.code}</div>
              </div>
            )}
          </div>

          {/* Quick amount buttons */}
          <div className="multi-deposit-section">
            <label htmlFor="deposit-amount" className="multi-deposit-label">
              <span>Amount ({currentToken.code})</span>
            </label>
            <input
              id="deposit-amount"
              type="number"
              placeholder={`Enter amount (e.g. 100)`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="multi-deposit-amount-input"
            />
            <div className="multi-deposit-quick-amounts">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`multi-deposit-quick-btn ${
                    amount === val.toString() ? 'active' : ''
                  }`}
                  onClick={() => handleQuickAmount(val)}
                >
                  +{val}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
