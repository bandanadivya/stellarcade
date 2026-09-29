//! Core data types for the tiered royalty distributor contract.

use soroban_sdk::{contracterror, contractevent, contracttype, Address};

/// Persistent storage TTL in ledgers (~30 days at 5 s/ledger).
pub const PERSISTENT_BUMP_LEDGERS: u32 = 518_400;

pub const BPS_DENOMINATOR: u32 = 10_000;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotConfigured = 1,
    InvalidInput = 2,
    SharesMustSumToTenThousand = 3,
    SplitLocked = 4,
    NothingToWithdraw = 5,
    EmptyRecipients = 6,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Admin,
    Recipients,
    Locked,
    /// Claimable balance for `(recipient, token)`.
    Claimable(Address, Address),
}

// ---------------------------------------------------------------------------
// Recipient share configuration
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecipientShare {
    pub address: Address,
    pub share_bps: u32,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct SplitConfigured {
    #[topic]
    pub admin: Address,
    pub recipient_count: u32,
}

#[contractevent]
pub struct RevenueDeposited {
    #[topic]
    pub sender: Address,
    #[topic]
    pub token: Address,
    pub amount: u128,
}

#[contractevent]
pub struct RecipientWithdrawal {
    #[topic]
    pub recipient: Address,
    #[topic]
    pub token: Address,
    pub amount: u128,
}

#[contractevent]
pub struct SplitLockedEvent {
    #[topic]
    pub admin: Address,
}
