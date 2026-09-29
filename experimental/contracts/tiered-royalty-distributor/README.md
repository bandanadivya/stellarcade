# Tiered Royalty Distributor

An experimental, pull-based Soroban revenue-share contract. An admin
configures a list of recipients and their basis-point shares; anyone can
then deposit revenue in a given token, which is credited proportionally to
each recipient's own claimable balance. Recipients withdraw their
accumulated balance on their own schedule, by calling `withdraw`
themselves.

This is an isolated, self-contained experimental contract. It does not
depend on, and is not depended on by, any contract under `contracts/`.

## Design

- **Configuration** — `configure_split` sets (or replaces) the recipient
  list, given as a `Vec<RecipientShare>` where each entry wraps
  `{ address, share_bps }`. Shares must sum to exactly `BPS_DENOMINATOR`
  (10,000 bps = 100%). The first successful call also fixes the contract
  admin.
- **Immutable lock** — `lock_split` (admin-only) permanently prevents any
  further `configure_split` calls. This cannot be undone; use it once a
  revenue split is finalized and recipients should be able to trust it
  won't change under them.
- **Deposit** — `deposit` pulls `amount` of a token from the caller and
  credits each recipient's claimable balance proportional to their
  `share_bps`, using floor division. Any basis-point rounding remainder
  (from flooring each recipient's proportional share) is credited to the
  **last** recipient, so no dust from the split is ever silently lost or
  left stuck in the contract — the same pattern used by
  `royalty-splitter::distribute_revenue`.
- **Withdrawal** — `withdraw` is pull-based: only the recipient themselves
  (enforced via `require_auth`) can withdraw their own claimable balance.
  It zeroes their balance, transfers the tokens to them, and returns the
  amount withdrawn. Errors if there is nothing to withdraw.

## Storage layout

- `instance()`: `Admin`, `Recipients` (the `Vec<RecipientShare>`),
  `Locked` — small, fixed-size configuration.
- `persistent()`: `Claimable(recipient, token)` — one entry per
  recipient/token pair, bumped on every write.

## Interface

```rust
fn configure_split(env: Env, admin: Address, recipients: Vec<RecipientShare>) -> Result<(), Error>;
fn lock_split(env: Env, admin: Address) -> Result<(), Error>;
fn deposit(env: Env, sender: Address, token: Address, amount: u128) -> Result<(), Error>;
fn withdraw(env: Env, recipient: Address, token: Address) -> Result<u128, Error>;
fn get_claimable(env: Env, recipient: Address, token: Address) -> u128;
fn get_recipients(env: Env) -> Vec<RecipientShare>;
fn is_locked(env: Env) -> bool;
```

`configure_split`, `lock_split`, `deposit`, and `withdraw` all enforce
`require_auth()` on the caller they act on behalf of; `configure_split`
(after the first call) and `lock_split` additionally require the caller to
match the configured `Admin`.

### Events

`SplitConfigured`, `RevenueDeposited`, `RecipientWithdrawal`,
`SplitLockedEvent`.

### Errors

`NotConfigured`, `InvalidInput`, `SharesMustSumToTenThousand`,
`SplitLocked`, `NothingToWithdraw`, `EmptyRecipients`.

## Usage (pseudo-flow)

```text
configure_split(admin, [{dev, 5_000}, {house, 3_000}, {community, 2_000}])
deposit(sender, token, 1_000 XLM)          // credits each recipient's claimable balance
withdraw(dev, token)                        // dev pulls their own share whenever they like
withdraw(house, token)
withdraw(community, token)

lock_split(admin)                           // permanently freezes the split
configure_split(admin, [...])               // now always fails: Error::SplitLocked
```

## Testing

```bash
cargo test --manifest-path experimental/contracts/tiered-royalty-distributor/Cargo.toml
```

Build for wasm (optional, requires the `wasm32-unknown-unknown` target):

```bash
rustup target add wasm32-unknown-unknown
cargo build --manifest-path experimental/contracts/tiered-royalty-distributor/Cargo.toml \
  --target wasm32-unknown-unknown --release
```
