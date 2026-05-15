/// WalrusPulse — On-chain form registry backed by Walrus decentralised storage.
///
/// Flow:
///   1. Creator calls `create_form(title, description, schema_blob_id, initial_admins)`.
///      The schema JSON is stored on Walrus; only the blob-id is recorded here.
///      The resulting `Form` object is *shared* so anyone can submit responses.
///
///   2. Respondents call `submit_response(form, response_blob_id)`.
///      Their answer JSON is stored on Walrus; only the blob-id is appended.
///
///   3. The admin reads `Form.response_blob_ids` on-chain, fetches each blob
///      from Walrus, and renders them in the dashboard.
///
///   4. The form owner can fund a SUI reward pool and manually send rewards
///      to deserving respondents. Each address can only be rewarded once per form.
///
///   5. The owner can add/remove co-admins who share most management permissions.
///      Only the original owner can add/remove admins and withdraw the reward pool.
module walrus_pulse::walrus_pulse {
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::vec_set::{Self, VecSet};
    use std::string::{Self, String};

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotOwner: u64         = 0;
    const EFormInactive: u64     = 1;
    const EInsufficientPool: u64 = 2;
    const EAlreadyRewarded: u64  = 3;
    const EZeroAmount: u64       = 4;
    const ENotAuthorized: u64    = 5;

    // ── Structs ──────────────────────────────────────────────────────────────

    /// Shared object representing a published form.
    public struct Form has key {
        id: UID,
        title: String,
        description: String,
        /// Walrus blob ID of the form schema JSON.
        schema_blob_id: String,
        /// Address that created this form (has full ownership rights).
        owner: address,
        /// Co-admin addresses — can manage the form but cannot withdraw the reward pool
        /// or add/remove other admins.
        admins: VecSet<address>,
        /// Ordered list of Walrus blob IDs for submitted responses.
        response_blob_ids: vector<String>,
        is_active: bool,
        /// SUI reward pool funded by the owner.
        reward_pool: Balance<SUI>,
        /// Set of addresses that have already received a reward for this form.
        rewarded: VecSet<address>,
    }

    // ── Events ───────────────────────────────────────────────────────────────

    public struct FormCreated has copy, drop {
        form_id: ID,
        title: String,
        schema_blob_id: String,
        owner: address,
    }

    public struct ResponseSubmitted has copy, drop {
        form_id: ID,
        response_blob_id: String,
        submitter: address,
    }

    public struct PoolFunded has copy, drop {
        form_id: ID,
        amount: u64,
        new_balance: u64,
    }

    public struct RewardSent has copy, drop {
        form_id: ID,
        recipient: address,
        amount: u64,
        remaining_pool: u64,
    }

    public struct AdminAdded has copy, drop {
        form_id: ID,
        admin: address,
        added_by: address,
    }

    public struct AdminRemoved has copy, drop {
        form_id: ID,
        admin: address,
        removed_by: address,
    }

    public struct OwnershipTransferred has copy, drop {
        form_id: ID,
        old_owner: address,
        new_owner: address,
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// Returns true if the sender is the form owner or a co-admin.
    fun is_authorized(form: &Form, ctx: &TxContext): bool {
        let sender = ctx.sender();
        sender == form.owner || vec_set::contains(&form.admins, &sender)
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Create a new shared Form object and emit a `FormCreated` event.
    /// `initial_admins` is an optional list of co-admin addresses.
    public entry fun create_form(
        title: vector<u8>,
        description: vector<u8>,
        schema_blob_id: vector<u8>,
        initial_admins: vector<address>,
        ctx: &mut TxContext,
    ) {
        let uid = object::new(ctx);
        let form_id = object::uid_to_inner(&uid);
        let owner = ctx.sender();

        let title_str = string::utf8(title);
        let desc_str = string::utf8(description);
        let schema_str = string::utf8(schema_blob_id);

        // Build admins VecSet, skipping the owner and duplicates
        let mut admins = vec_set::empty<address>();
        let mut i = 0u64;
        while (i < initial_admins.length()) {
            let admin = initial_admins[i];
            if (admin != owner && !vec_set::contains(&admins, &admin)) {
                vec_set::insert(&mut admins, admin);
                event::emit(AdminAdded {
                    form_id,
                    admin,
                    added_by: owner,
                });
            };
            i = i + 1;
        };

        event::emit(FormCreated {
            form_id,
            title: title_str,
            schema_blob_id: schema_str,
            owner,
        });

        transfer::share_object(Form {
            id: uid,
            title: title_str,
            description: desc_str,
            schema_blob_id: schema_str,
            owner,
            admins,
            response_blob_ids: vector[],
            is_active: true,
            reward_pool: balance::zero<SUI>(),
            rewarded: vec_set::empty<address>(),
        });
    }

    /// Append a response blob ID to the form and emit `ResponseSubmitted`.
    public entry fun submit_response(
        form: &mut Form,
        response_blob_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(form.is_active, EFormInactive);

        let response_str = string::utf8(response_blob_id);
        let submitter = ctx.sender();

        event::emit(ResponseSubmitted {
            form_id: object::uid_to_inner(&form.id),
            response_blob_id: response_str,
            submitter,
        });

        form.response_blob_ids.push_back(response_str);
    }

    /// Deactivate a form so it no longer accepts responses.
    /// Owner or any co-admin can call this.
    public entry fun deactivate_form(form: &mut Form, ctx: &TxContext) {
        assert!(is_authorized(form, ctx), ENotAuthorized);
        form.is_active = false;
    }

    // ── Admin management ──────────────────────────────────────────────────────

    /// Add a co-admin to the form. Only the owner can call this.
    public entry fun add_admin(form: &mut Form, new_admin: address, ctx: &TxContext) {
        assert!(form.owner == ctx.sender(), ENotOwner);
        if (!vec_set::contains(&form.admins, &new_admin)) {
            vec_set::insert(&mut form.admins, new_admin);
            event::emit(AdminAdded {
                form_id: object::uid_to_inner(&form.id),
                admin: new_admin,
                added_by: ctx.sender(),
            });
        };
    }

    /// Remove a co-admin from the form. Only the owner can call this.
    public entry fun remove_admin(form: &mut Form, admin: address, ctx: &TxContext) {
        assert!(form.owner == ctx.sender(), ENotOwner);
        if (vec_set::contains(&form.admins, &admin)) {
            vec_set::remove(&mut form.admins, &admin);
            event::emit(AdminRemoved {
                form_id: object::uid_to_inner(&form.id),
                admin,
                removed_by: ctx.sender(),
            });
        };
    }

    /// Transfer form ownership to a new address. Only the current owner can call this.
    /// The old owner is automatically removed from everything; the new owner inherits full control.
    public entry fun transfer_ownership(form: &mut Form, new_owner: address, ctx: &TxContext) {
        assert!(form.owner == ctx.sender(), ENotOwner);
        assert!(new_owner != form.owner, ENotOwner);

        // Remove new_owner from admins if they were a co-admin
        if (vec_set::contains(&form.admins, &new_owner)) {
            vec_set::remove(&mut form.admins, &new_owner);
        };

        let old_owner = form.owner;
        form.owner = new_owner;

        event::emit(OwnershipTransferred {
            form_id: object::uid_to_inner(&form.id),
            old_owner,
            new_owner,
        });
    }

    // ── Reward pool functions ─────────────────────────────────────────────────

    /// Owner-only: deposits SUI into the form's reward pool.
    public entry fun fund_reward_pool(
        form: &mut Form,
        payment: Coin<SUI>,
        ctx: &TxContext,
    ) {
        assert!(form.owner == ctx.sender(), ENotOwner);

        let amount = coin::value(&payment);
        assert!(amount > 0, EZeroAmount);

        balance::join(&mut form.reward_pool, coin::into_balance(payment));

        event::emit(PoolFunded {
            form_id: object::uid_to_inner(&form.id),
            amount,
            new_balance: balance::value(&form.reward_pool),
        });
    }

    /// Owner-only: manually sends a SUI reward to a recipient address.
    /// Each address can only be rewarded once per form.
    public entry fun reward_respondent(
        form: &mut Form,
        recipient: address,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        assert!(form.owner == ctx.sender(), ENotOwner);
        assert!(amount > 0, EZeroAmount);
        assert!(balance::value(&form.reward_pool) >= amount, EInsufficientPool);
        assert!(!vec_set::contains(&form.rewarded, &recipient), EAlreadyRewarded);

        // Mark as rewarded before transfer (checks-effects-interactions)
        vec_set::insert(&mut form.rewarded, recipient);

        let reward_balance = balance::split(&mut form.reward_pool, amount);
        let reward_coin = coin::from_balance(reward_balance, ctx);
        transfer::public_transfer(reward_coin, recipient);

        event::emit(RewardSent {
            form_id: object::uid_to_inner(&form.id),
            recipient,
            amount,
            remaining_pool: balance::value(&form.reward_pool),
        });
    }

    /// Owner-only: withdraw remaining SUI from the reward pool.
    public entry fun withdraw_reward_pool(
        form: &mut Form,
        ctx: &mut TxContext,
    ) {
        assert!(form.owner == ctx.sender(), ENotOwner);

        let pool_amount = balance::value(&form.reward_pool);
        assert!(pool_amount > 0, EInsufficientPool);

        let all_balance = balance::split(&mut form.reward_pool, pool_amount);
        let coin = coin::from_balance(all_balance, ctx);
        transfer::public_transfer(coin, form.owner);
    }

    // ── Read-only helpers ─────────────────────────────────────────────────────

    public fun schema_blob_id(form: &Form): String { form.schema_blob_id }
    public fun title(form: &Form): String { form.title }
    public fun owner(form: &Form): address { form.owner }
    public fun is_active(form: &Form): bool { form.is_active }
    public fun response_count(form: &Form): u64 { form.response_blob_ids.length() }
    public fun response_blob_ids(form: &Form): vector<String> { form.response_blob_ids }
    public fun reward_pool_balance(form: &Form): u64 { balance::value(&form.reward_pool) }
    public fun is_rewarded(form: &Form, addr: address): bool {
        vec_set::contains(&form.rewarded, &addr)
    }
    public fun admins(form: &Form): vector<address> {
        *vec_set::keys(&form.admins)
    }
}
