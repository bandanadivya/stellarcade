# Token Swap Micro Widget

An experimental in-game swap control that stays in the corner of the match view.

## Behavior

- Collapsed by default so the game canvas remains visible.
- Shows balances, a live output estimate, and slippage presets.
- Provides +10, +50, and MAX amount shortcuts.
- Blocks empty and over-balance submissions.
- Disables execution while a swap is pending and reports completion accessibly.

The widget only owns presentation and interaction. The host supplies token data, exchange rate, and the asynchronous swap handler.