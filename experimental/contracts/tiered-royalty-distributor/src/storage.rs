//! Storage helpers for the tiered royalty distributor contract.

use soroban_sdk::{vec, Address, Env, Vec};

use crate::types::{DataKey, Error, RecipientShare, PERSISTENT_BUMP_LEDGERS};

pub fn is_configured(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn require_configured(env: &Env) -> Result<(), Error> {
    if !is_configured(env) {
        return Err(Error::NotConfigured);
    }
    Ok(())
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_recipients(env: &Env) -> Vec<RecipientShare> {
    env.storage()
        .instance()
        .get(&DataKey::Recipients)
        .unwrap_or_else(|| vec![env])
}

pub fn set_recipients(env: &Env, recipients: &Vec<RecipientShare>) {
    env.storage()
        .instance()
        .set(&DataKey::Recipients, recipients);
}

pub fn is_locked(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Locked)
        .unwrap_or(false)
}

pub fn set_locked(env: &Env) {
    env.storage().instance().set(&DataKey::Locked, &true);
}

pub fn get_claimable(env: &Env, recipient: &Address, token: &Address) -> u128 {
    env.storage()
        .persistent()
        .get(&DataKey::Claimable(recipient.clone(), token.clone()))
        .unwrap_or(0)
}

pub fn set_claimable(env: &Env, recipient: &Address, token: &Address, amount: u128) {
    let key = DataKey::Claimable(recipient.clone(), token.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);
}
