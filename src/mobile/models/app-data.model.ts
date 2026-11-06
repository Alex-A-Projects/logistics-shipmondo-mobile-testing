/**
 * Shapes of the Shipmondo web app's **internal** JSON API (`/api/v1`, `/api/v2`).
 *
 * These are the endpoints the app's own XHRs call to fill its datatables. A
 * mobile-web test reads them to cross-check what was rendered against what
 * was fetched — the mobile-web equivalent of the desktop suite's API
 * cross-checks.
 *
 * The field names and types below were read from live responses of the demo
 * app. Only the fields the suite actually relies on are declared: a field the
 * suite does not assert on is a field that should not be able to break a test.
 */

/**
 * The envelope every internal datatable endpoint returns.
 *
 * `recordsTotal` is the number of records the server holds; `recordsFiltered`
 * is the number that survived the current filters. Both are `0` for an empty
 * list.
 */
export interface DatatableEnvelope<T> {
    draw: number;
    recordsTotal: number;
    recordsFiltered: number;
    /** Echoed filters. Present on some endpoints only. */
    filters?: unknown;
    /** Filters the server rejected. Present on some endpoints only. */
    invalid_filter_selections?: unknown;
    /** The rows of the current page. */
    data: T[];
}

/** A booked shipment (`POST /api/v2/shipments/datatable`). */
export interface ShipmentRow {
    id: number;
    receiver_name: string;
    receiver_attention: string | null;
    receiver_address1: string;
    receiver_city: string;
    receiver_zipcode: string;
    receiver_country: string;
    sender_name: string;
    sender_attention: string | null;
    sender_address1: string;
    sender_city: string;
    sender_zipcode: string;
    sender_country: string;
    sender_email: string;
    created_at: string;
    shipping_agent: string;
    own_agreement: boolean;
    /** The order reference the shipment was created from. */
    reference: string;
    additional_reference: string | null;
    source_id: string;
    source_type: string;
    /** The shipment's lifecycle state; `null` before it has been sent. */
    current_state: string | null;
    refundable_status: Record<string, unknown>;
    cancellable_at_carrier: boolean;
    cancelled_at_carrier: boolean;
    refunded: boolean;
    shipping_product_name: string;
    row_disabled: boolean;
    qr_code_available: boolean;
    pickup_request_available: boolean;
    cancel_and_refund_status: string | null;
}

/** A sales order (`POST /api/v2/order_management/sales_orders/datatable.json`). */
export interface SalesOrderRow {
    id: number;
    amount_including_vat: string;
    created_at: string;
    currency_code: string;
    fulfillment_status: string;
    ordered_at: string;
    order_status: string;
    ship_to_name: string;
    ship_to_country_code: string;
    ship_to_city: string;
    ship_to_zipcode: string;
    source_name: string;
    payment_status: string;
    fulfilled_percent: number;
    shipped_percent: number;
    returned_percent: number;
    return_percent: number;
    payment_method_code: string;
    external_document_status: string | null;
    shipment_method_name: string;
    order_note: string | null;
    item_locations: string | null;
    total_weight: number;
    current_shipping_agent_code: string;
    risk_recommendation: string | null;
    tags: unknown;
    updated_at: string;
    reference: string | null;
    address_validation_state: string | null;
    /** A stringified quantity, not a number. */
    quantity: string;
    /** A stringified quantity, not a number. */
    item_lines_quantity: string;
    item_lines_count: number;
    external_document_id: string;
    assigned_to: string | null;
    is_returning_customer: boolean;
    last_event_text: string;
}

/**
 * A saved address (`POST /api/v1/regular_receivers/datatable.json`).
 *
 * The demo tenant has **no** saved addresses, so the row shape could not be
 * read from a live response. The fields are therefore left untyped rather
 * than invented — a test that needs them must first create an address.
 */
export type RegularReceiverRow = Record<string, unknown>;

/**
 * An API access entry (`POST /api/v2/api_credentials/datatable.json`).
 *
 * Note what is **not** here: the API key itself. The response carries only
 * the entry's metadata, so reading this endpoint can never leak a secret.
 */
export interface ApiCredentialRow {
    id: number;
    name: string;
    active: boolean;
    created_at: string;
    updated_at: string;
    /** Timestamp of the last use, or `null` if never used. */
    last_used: string | null;
    created_by: string | null;
}

/** The account record of the signed-in user (`GET /api/v1/account.json`). */
export interface AccountRecord {
    email?: string;
    [key: string]: unknown;
}
