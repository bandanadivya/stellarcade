//! Tiered Royalty Distributor
//!
//! A pull-based Soroban revenue-share contract. An admin configures a list
//! of recipients and their basis-point shares (summing to exactly
//! 10,000 bps = 100%). Anyone can then deposit revenue in a given token,
//! which is credited proportionally to each recipient's claimable
//! balance. Recipients withdraw their own accumulated balance whenever
//! they choose, by calling `withdraw` themselves.
//!
//! ## Storage Strategy
//! - `instance()`: Admin, the recipient/share list, and the immutable-lock
//!   flag. Small, shared configuration.
//! - `persistent()`: `Claimable(recipient, token)`, bumped on every write.
//!
//! ## Invariants
//! - `configure_split` may be called repeatedly to change the recipient
//!   list, UNLESS the split has been permanently locked via `lock_split`,
//!   in which case every subsequent `configure_split` call fails.
//! - `share_bps` values across all recipients must sum to exactly
//!   `BPS_DENOMINATOR` (10,000 = 100%).
//! - `deposit` splits `amount` proportionally to each recipient's
//!   `share_bps` using floor division; any rounding remainder left over
//!   after every recipient's floor-rounded share is allocated is credited
//!   to the LAST recipient, so no dust is ever silently lost or left
//!   stuck in the contract (mirrors `royalty-splitter::distribute_revenue`).
//! - `withdraw` is pull-based: only the recipient themselves (via
//!   `require_auth`) can withdraw their own claimable balance.
#![no_std]
#![allow(unexpected_cfgs)]

mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};

pub use types::Error;
use types::{
    RecipientShare, RecipientWithdrawal, RevenueDeposited, SplitConfigured, SplitLockedEvent,
    BPS_DENOMINATOR,
};

#[contract]
pub struct TieredRoyaltyDistributor;

#[contractimpl]
impl TieredRoyaltyDistributor {
    // -----------------------------------------------------------------------
    // configure_split
    // -----------------------------------------------------------------------

    /// Configure (or reconfigure) the recipient list and their basis-point
    /// shares. `share_bps` values must sum to exactly `BPS_DENOMINATOR`
    /// (10,000 = 100%). The first call to `configure_split` also sets the
    /// contract admin. Fails if the split has been permanently locked via
    /// `lock_split`.
    pub fn configure_split(
        env: Env,
        admin: Address,
        recipients: Vec<RecipientShare>,
    ) -> Result<(), Error> {
        if storage::is_configured(&env) {
            let existing_admin = storage::get_admin(&env);
            if admin != existing_admin {
                return Err(Error::InvalidInput);
            }
            if storage::is_locked(&env) {
                return Err(Error::SplitLocked);
            }
        }

        admin.require_auth();
        validate_shares(&recipients)?;

        storage::set_admin(&env, &admin);
        storage::set_recipients(&env, &recipients);

        SplitConfigured {
            admin,
            recipient_count: recipients.len(),
        }
        .publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // lock_split
    // -----------------------------------------------------------------------

    /// Admin-only: permanently prevent any further `configure_split`
    /// calls. This cannot be undone.
    pub fn lock_split(env: Env, admin: Address) -> Result<(), Error> {
        storage::require_configured(&env)?;
        admin.require_auth();

        if admin != storage::get_admin(&env) {
            return Err(Error::InvalidInput);
        }

        storage::set_locked(&env);

        SplitLockedEvent { admin }.publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // deposit
    // -----------------------------------------------------------------------

    /// Pull `amount` of `token` from `sender` into the contract, and
    /// credit each configured recipient's claimable balance proportional
    /// to their `share_bps` (floor division). Any rounding remainder is
    /// credited to the last recipient, so no dust is lost.
    pub fn deposit(env: Env, sender: Address, token: Address, amount: u128) -> Result<(), Error> {
        storage::require_configured(&env)?;
        sender.require_auth();

        if amount == 0 {
            return Err(Error::InvalidInput);
        }

        let amount_i128 = i128_from_u128(amount)?;

        let token_client = token::Client::new(&env, &token);
        let contract_address = env.current_contract_address();
        token_client.transfer(&sender, &contract_address, &amount_i128);

        let recipients = storage::get_recipients(&env);
        let count = recipients.len();

        let mut allocated: u128 = 0;
        for i in 0..count {
            let recipient_share = recipients.get(i).unwrap();

            let mut share_amount = amount
                .checked_mul(recipient_share.share_bps as u128)
                .and_then(|v| v.checked_div(BPS_DENOMINATOR as u128))
                .ok_or(Error::InvalidInput)?;

            // Last recipient absorbs any rounding remainder so no dust is
            // silently lost.
            if i == count - 1 {
                share_amount = amount - allocated;
            }
            allocated += share_amount;

            let existing = storage::get_claimable(&env, &recipient_share.address, &token);
            storage::set_claimable(
                &env,
                &recipient_share.address,
                &token,
                existing + share_amount,
            );
        }

        RevenueDeposited {
            sender,
            token,
            amount,
        }
        .publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // withdraw
    // -----------------------------------------------------------------------

    /// Pull-based withdrawal: `recipient` withdraws their own full
    /// claimable balance of `token`. Zeroes the claimable balance,
    /// transfers the tokens to `recipient`, and returns the amount
    /// withdrawn. Errors if there is nothing to withdraw.
    pub fn withdraw(env: Env, recipient: Address, token: Address) -> Result<u128, Error> {
        storage::require_configured(&env)?;
        recipient.require_auth();

        let amount = storage::get_claimable(&env, &recipient, &token);
        if amount == 0 {
            return Err(Error::NothingToWithdraw);
        }

        storage::set_claimable(&env, &recipient, &token, 0);

        let amount_i128 = i128_from_u128(amount)?;
        let token_client = token::Client::new(&env, &token);
        let contract_address = env.current_contract_address();
        token_client.transfer(&contract_address, &recipient, &amount_i128);

        RecipientWithdrawal {
            recipient,
            token,
            amount,
        }
        .publish(&env);

        Ok(amount)
    }

    // -----------------------------------------------------------------------
    // read helpers
    // -----------------------------------------------------------------------

    pub fn get_claimable(env: Env, recipient: Address, token: Address) -> u128 {
        storage::get_claimable(&env, &recipient, &token)
    }

    pub fn get_recipients(env: Env) -> Vec<RecipientShare> {
        storage::get_recipients(&env)
    }

    pub fn is_locked(env: Env) -> bool {
        storage::is_locked(&env)
    }
}

fn validate_shares(recipients: &Vec<RecipientShare>) -> Result<(), Error> {
    if recipients.is_empty() {
        return Err(Error::EmptyRecipients);
    }

    let mut total: u32 = 0;
    for recipient in recipients.iter() {
        total = total
            .checked_add(recipient.share_bps)
            .ok_or(Error::InvalidInput)?;
    }
    if total != BPS_DENOMINATOR {
        return Err(Error::SharesMustSumToTenThousand);
    }

    Ok(())
}

fn i128_from_u128(amount: u128) -> Result<i128, Error> {
    i128::try_from(amount).map_err(|_| Error::InvalidInput)
}
