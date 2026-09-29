export interface TokenInfo {
  symbol: string;
  balance: number;
}

export interface TokenSwapMicroWidgetProps {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  exchangeRate: number;
  onSwap: (amount: string, slippage: number) => Promise<void>;
}