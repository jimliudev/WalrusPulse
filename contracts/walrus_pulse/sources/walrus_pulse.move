/// WalrusPulse — On-chain form registry backed by Walrus decentralised storage.
///
/// Flow:
///   1. Creator calls `create_form(title, description, schema_blob_id)`.
///      The schema JSON is stored on Walrus; only the blob-id is recorded here.
///      The resulting `Form` object is *shared* so anyone can submit responses.
///
///   2. Respondents call `submit_response(form, response_blob_id)`.
///      Their answer JSON is stored on Walrus; only the blob-id is appended.
///
///   3. The admin reads `Form.response_blob_ids` on-chain, fetches each blob
///      from Walrus, and renders them in the dashboard.
module walrus_pulse::walrus_pulse {
    use sui::event;
    use std::string::{Self, String};

    // ── Structs ──────────────────────────────────────────────────────────────

    /// Shared object representing a published form.
    public struct Form has key {
        id: UID,
        title: String,
        description: String,
        /// Walrus blob ID of the form schema JSON.
        schema_blob_id: String,
        /// Address that created this form.
        owner: address,
        /// Ordered list of Walrus blob IDs for submitted responses.
        response_blob_ids: vector<String>,
        is_active: bool,
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

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Create a new shared Form object and emit a `FormCreated` event.
    public entry fun create_form(
        title: vector<u8>,
        description: vector<u8>,
        schema_blob_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let uid = object::new(ctx);
        let form_id = object::uid_to_inner(&uid);
        let owner = ctx.sender();

        let title_str = string::utf8(title);
        let desc_str = string::utf8(description);
        let schema_str = string::utf8(schema_blob_id);

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
            response_blob_ids: vector[],
            is_active: true,
        });
    }

    /// Append a response blob ID to the form and emit `ResponseSubmitted`.
    public entry fun submit_response(
        form: &mut Form,
        response_blob_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(form.is_active, 0);

        let response_str = string::utf8(response_blob_id);
        let submitter = ctx.sender();

        event::emit(ResponseSubmitted {
            form_id: object::uid_to_inner(&form.id),
            response_blob_id: response_str,
            submitter,
        });

        form.response_blob_ids.push_back(response_str);
    }

    /// Deactivate a form so it no longer accepts responses. Only the owner can do this.
    public entry fun deactivate_form(form: &mut Form, ctx: &TxContext) {
        assert!(form.owner == ctx.sender(), 1);
        form.is_active = false;
    }

    // ── Read-only helpers ─────────────────────────────────────────────────────

    public fun schema_blob_id(form: &Form): String { form.schema_blob_id }
    public fun title(form: &Form): String { form.title }
    public fun owner(form: &Form): address { form.owner }
    public fun is_active(form: &Form): bool { form.is_active }
    public fun response_count(form: &Form): u64 { form.response_blob_ids.length() }
    public fun response_blob_ids(form: &Form): vector<String> { form.response_blob_ids }
}
