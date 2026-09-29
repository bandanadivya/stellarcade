#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, vec, Address, Env};

fn recipient_share(_env: &Env, address: &Address, share_bps: u32) -> RecipientShare {
    RecipientShare {
        address: address.clone(),
        share_bps,
    }
}

fn setup<'a>(
    env: &'a Env,
    shares_bps: &[u32],
) -> (
    TieredRoyaltyDistributorClient<'a>,
    Address,
    Address,
    Vec<Address>,
) {
    let admin = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_contract_id = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = token_contract_id.address();

    let mut addresses: Vec<Address> = Vec::new(env);
    let mut recipients: Vec<RecipientShare> = Vec::new(env);
    for &s in shares_bps {
        let addr = Address::generate(env);
        addresses.push_back(addr.clone());
        recipients.push_back(recipient_share(env, &addr, s));
    }

    let contract_id = env.register(TieredRoyaltyDistributor, ());
    let client = TieredRoyaltyDistributorClient::new(env, &contract_id);

    env.mock_all_auths();
    client.configure_split(&admin, &recipients);

    (client, admin, token_address, addresses)
}

fn mint(env: &Env, token_address: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token_address).mint(to, &amount);
}

// ---------------------------------------------------------------------------
// 1. split configuration enforces exactly 10,000 bps total
// ---------------------------------------------------------------------------

#[test]
fn test_configure_split_rejects_shares_not_summing_to_ten_thousand() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    let contract_id = env.register(TieredRoyaltyDistributor, ());
    let client = TieredRoyaltyDistributorClient::new(&env, &contract_id);

    let recipients = vec![
        &env,
        recipient_share(&env, &r1, 5_000),
        recipient_share(&env, &r2, 4_000),
    ];

    let result = client.try_configure_split(&admin, &recipients);
    assert_eq!(result, Err(Ok(Error::SharesMustSumToTenThousand)));
}

#[test]
fn test_configure_split_accepts_exactly_ten_thousand_bps() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    let contract_id = env.register(TieredRoyaltyDistributor, ());
    let client = TieredRoyaltyDistributorClient::new(&env, &contract_id);

    let recipients = vec![
        &env,
        recipient_share(&env, &r1, 6_000),
        recipient_share(&env, &r2, 4_000),
    ];

    client.configure_split(&admin, &recipients);
    assert_eq!(client.get_recipients().len(), 2);
}

#[test]
fn test_configure_split_rejects_empty_recipients() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let contract_id = env.register(TieredRoyaltyDistributor, ());
    let client = TieredRoyaltyDistributorClient::new(&env, &contract_id);

    let recipients: Vec<RecipientShare> = Vec::new(&env);
    let result = client.try_configure_split(&admin, &recipients);
    assert_eq!(result, Err(Ok(Error::EmptyRecipients)));
}

// ---------------------------------------------------------------------------
// 2. depositing revenue increases claimable proportionally, with rounding
// ---------------------------------------------------------------------------

#[test]
fn test_deposit_credits_recipients_proportionally() {
    let env = Env::default();
    env.mock_all_auths();
    // 50% / 30% / 20%.
    let (client, _admin, token_address, recipients) = setup(&env, &[5_000, 3_000, 2_000]);

    let sender = Address::generate(&env);
    mint(&env, &token_address, &sender, 10_000_000_000);

    client.deposit(&sender, &token_address, &10_000_000_000u128);

    assert_eq!(
        client.get_claimable(&recipients.get(0).unwrap(), &token_address),
        5_000_000_000u128
    );
    assert_eq!(
        client.get_claimable(&recipients.get(1).unwrap(), &token_address),
        3_000_000_000u128
    );
    assert_eq!(
        client.get_claimable(&recipients.get(2).unwrap(), &token_address),
        2_000_000_000u128
    );

    // Tokens were pulled into the contract, not yet paid out.
    let tc = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(tc.balance(&recipients.get(0).unwrap()), 0);
}

#[test]
fn test_deposit_rounding_remainder_goes_to_last_recipient() {
    let env = Env::default();
    env.mock_all_auths();
    // 3333/3333/3334 bps of 10 units floors to 3/3/3 = 9, with 1 unit of
    // remainder that must land on the LAST recipient, not get stuck in
    // the contract.
    let (client, _admin, token_address, recipients) = setup(&env, &[3_333, 3_333, 3_334]);

    let sender = Address::generate(&env);
    mint(&env, &token_address, &sender, 10);
    client.deposit(&sender, &token_address, &10u128);

    let c0 = client.get_claimable(&recipients.get(0).unwrap(), &token_address);
    let c1 = client.get_claimable(&recipients.get(1).unwrap(), &token_address);
    let c2 = client.get_claimable(&recipients.get(2).unwrap(), &token_address);

    assert_eq!(c0 + c1 + c2, 10); // no dust left unaccounted for
    assert_eq!(c2, 10 - c0 - c1); // remainder landed on the last recipient
}

#[test]
fn test_deposit_accumulates_across_multiple_deposits() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, token_address, recipients) = setup(&env, &[5_000, 5_000]);

    let sender = Address::generate(&env);
    mint(&env, &token_address, &sender, 400);
    client.deposit(&sender, &token_address, &200u128);
    client.deposit(&sender, &token_address, &200u128);

    assert_eq!(
        client.get_claimable(&recipients.get(0).unwrap(), &token_address),
        200u128
    );
    assert_eq!(
        client.get_claimable(&recipients.get(1).unwrap(), &token_address),
        200u128
    );
}

#[test]
fn test_deposit_rejects_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, token_address, _recipients) = setup(&env, &[10_000]);

    let sender = Address::generate(&env);
    let result = client.try_deposit(&sender, &token_address, &0u128);
    assert_eq!(result, Err(Ok(Error::InvalidInput)));
}

// ---------------------------------------------------------------------------
// 3. withdrawal transfers tokens AND zeroes claimable balance
// ---------------------------------------------------------------------------

#[test]
fn test_withdraw_transfers_tokens_and_zeroes_claimable() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, token_address, recipients) = setup(&env, &[6_000, 4_000]);

    let sender = Address::generate(&env);
    mint(&env, &token_address, &sender, 10_000_000_000);
    client.deposit(&sender, &token_address, &10_000_000_000u128);

    let recipient_0 = recipients.get(0).unwrap();
    let withdrawn = client.withdraw(&recipient_0, &token_address);
    assert_eq!(withdrawn, 6_000_000_000u128);

    let tc = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(tc.balance(&recipient_0), 6_000_000_000);
    assert_eq!(client.get_claimable(&recipient_0, &token_address), 0);

    // The other recipient's claimable balance is untouched.
    let recipient_1 = recipients.get(1).unwrap();
    assert_eq!(
        client.get_claimable(&recipient_1, &token_address),
        4_000_000_000u128
    );
}

#[test]
fn test_withdrawing_twice_only_pays_out_once() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, token_address, recipients) = setup(&env, &[10_000]);

    let sender = Address::generate(&env);
    mint(&env, &token_address, &sender, 100);
    client.deposit(&sender, &token_address, &100u128);

    let recipient = recipients.get(0).unwrap();
    client.withdraw(&recipient, &token_address);

    let result = client.try_withdraw(&recipient, &token_address);
    assert_eq!(result, Err(Ok(Error::NothingToWithdraw)));
}

// ---------------------------------------------------------------------------
// 4. withdrawing with zero claimable balance errors
// ---------------------------------------------------------------------------

#[test]
fn test_withdraw_with_nothing_claimable_errors() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, token_address, recipients) = setup(&env, &[10_000]);

    let result = client.try_withdraw(&recipients.get(0).unwrap(), &token_address);
    assert_eq!(result, Err(Ok(Error::NothingToWithdraw)));
}

// ---------------------------------------------------------------------------
// 5. locking prevents further configure_split calls
// ---------------------------------------------------------------------------

#[test]
fn test_lock_split_prevents_further_configuration() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _token_address, _recipients) = setup(&env, &[10_000]);

    client.lock_split(&admin);
    assert!(client.is_locked());

    let new_recipient = Address::generate(&env);
    let new_recipients = vec![&env, recipient_share(&env, &new_recipient, 10_000)];
    let result = client.try_configure_split(&admin, &new_recipients);
    assert_eq!(result, Err(Ok(Error::SplitLocked)));
}

#[test]
fn test_lock_split_by_non_admin_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token_address, _recipients) = setup(&env, &[10_000]);

    let not_admin = Address::generate(&env);
    let result = client.try_lock_split(&not_admin);
    assert_eq!(result, Err(Ok(Error::InvalidInput)));
}

#[test]
fn test_configure_split_before_locking_still_allowed() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _token_address, _recipients) = setup(&env, &[10_000]);

    let new_recipient = Address::generate(&env);
    let new_recipients = vec![&env, recipient_share(&env, &new_recipient, 10_000)];
    // Should succeed since the split hasn't been locked yet.
    client.configure_split(&admin, &new_recipients);
    assert_eq!(client.get_recipients().len(), 1);
}
