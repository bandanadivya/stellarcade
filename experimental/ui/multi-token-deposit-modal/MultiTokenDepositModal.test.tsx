import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
import { MultiTokenDepositModal } from './MultiTokenDepositModal';
import { TokenOption } from './types';

describe('MultiTokenDepositModal', () => {
  const mockTokens: TokenOption[] = [
    {
      code: 'XLM',
      name: 'Stellar Lumens',
      balance: 1450.5,
      hasTrustline: true,
    },
    {
      code: 'USDC',
      name: 'USD Coin',
      balance: 250,
      hasTrustline: true,
    },
    {
      code: 'AQUA',
      name: 'Aqua Network Token',
      balance: 0,
      hasTrustline: false,
    },
  ];

  const depositAddress = 'GDZX4KPW2N3DAB76R74L6ZXYY5ZMQZ4K6G653M5LQPXQ3Q';
  let mockWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });
  });

  it('does not render when isOpen is false', () => {
    render(
      <MultiTokenDepositModal
        isOpen={false}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal dialog when isOpen is true', () => {
    render(
      <MultiTokenDepositModal
        isOpen={true}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Deposit Assets')).toBeInTheDocument();
    expect(screen.getByTestId('deposit-address')).toHaveTextContent(depositAddress);
  });

  it('switches selected token and updates deposit details', () => {
    const handleSelectToken = vi.fn();
    render(
      <MultiTokenDepositModal
        isOpen={true}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={vi.fn()}
        onSelectToken={handleSelectToken}
      />
    );

    const selector = screen.getByRole('combobox', { name: /Select deposit asset/i });
    expect(selector).toHaveValue('XLM');

    fireEvent.change(selector, { target: { value: 'USDC' } });

    expect(handleSelectToken).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'USDC', name: 'USD Coin' })
    );
    expect(screen.getByText('USD Coin')).toBeInTheDocument();
    expect(screen.getByText('Balance: 250 USDC')).toBeInTheDocument();
  });

  it('displays warning message when selected token lacks trustline', () => {
    render(
      <MultiTokenDepositModal
        isOpen={true}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={vi.fn()}
      />
    );

    // Initial XLM has active trustline
    expect(screen.getByTestId('trustline-badge')).toHaveTextContent('Active');
    expect(screen.queryByTestId('trustline-warning')).not.toBeInTheDocument();

    // Switch to AQUA which has hasTrustline: false
    const selector = screen.getByRole('combobox', { name: /Select deposit asset/i });
    fireEvent.change(selector, { target: { value: 'AQUA' } });

    expect(screen.getByTestId('trustline-badge')).toHaveTextContent('Needs Trustline');
    expect(screen.getByTestId('trustline-warning')).toBeInTheDocument();
    expect(screen.getByTestId('trustline-warning')).toHaveTextContent(
      'wallet does not currently have a trustline established for AQUA'
    );
  });

  it('copies address to clipboard and provides visual feedback', async () => {
    render(
      <MultiTokenDepositModal
        isOpen={true}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={vi.fn()}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /Copy deposit address/i });
    expect(copyBtn).toHaveTextContent('Copy');

    fireEvent.click(copyBtn);

    expect(mockWriteText).toHaveBeenCalledWith(depositAddress);
    await waitFor(() => {
      expect(copyBtn).toHaveTextContent('Copied!');
      expect(copyBtn).toHaveClass('copied');
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <MultiTokenDepositModal
        isOpen={true}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /Close deposit modal/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when ESC key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <MultiTokenDepositModal
        isOpen={true}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={handleClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('toggles QR code preview when button is clicked', () => {
    render(
      <MultiTokenDepositModal
        isOpen={true}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={vi.fn()}
      />
    );

    const qrToggleBtn = screen.getByRole('button', { name: /Toggle QR code/i });
    expect(screen.queryByTestId('qr-code-preview')).not.toBeInTheDocument();

    fireEvent.click(qrToggleBtn);
    expect(screen.getByTestId('qr-code-preview')).toBeInTheDocument();

    fireEvent.click(qrToggleBtn);
    expect(screen.queryByTestId('qr-code-preview')).not.toBeInTheDocument();
  });

  it('updates amount field when quick amount buttons are clicked', () => {
    render(
      <MultiTokenDepositModal
        isOpen={true}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={vi.fn()}
      />
    );

    const amountInput = screen.getByRole('spinbutton');
    const quick100Btn = screen.getByRole('button', { name: '+100' });

    fireEvent.click(quick100Btn);
    expect(amountInput).toHaveValue(100);

    const quick500Btn = screen.getByRole('button', { name: '+500' });
    fireEvent.click(quick500Btn);
    expect(amountInput).toHaveValue(500);
  });

  it('renders network memo requirement warning banner', () => {
    render(
      <MultiTokenDepositModal
        isOpen={true}
        tokens={mockTokens}
        depositAddress={depositAddress}
        onClose={vi.fn()}
        memoId="987654321"
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Your Memo ID is: 987654321/i)).toBeInTheDocument();
  });
});
