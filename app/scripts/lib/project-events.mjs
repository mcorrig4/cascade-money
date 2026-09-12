// Projects a raw sim NDJSON event object down to exactly the envelope and
// `data` fields the app's loader (src/data/adapters.ts, src/data/index.ts,
// src/data/overlay-selectors.ts, src/director/ShotOverlays.tsx,
// src/director/shots.ts, src/components/DayLedger.tsx, src/globe/arc-pool.ts)
// reads. Everything else (the exact-rational cumulative `index` field on
// non-checkpoint events, unused invoice/entitlement/checkpoint/metrics
// fields, `actor`, `request_id`, `dates`) is dropped. This is a lossless
// projection with respect to app behavior: every field the app can reach for
// any event type is preserved with its original value and type.
//
// `balance_sheet` keeps only the seven totals the vault overlay (shot 9,
// ShotOverlays.tsx) reads: backing_value_cents, dated_cents, spot_cents,
// unclaimed_accrued_cents, reserve_cents, deficit_cents, claimable_cents.
// `checks.hard` / `checks.breaches` are kept in full (all keys), since the
// overlay renders every entry generically via Object.entries.
// `index` (the exact-rational cumulative index snapshot) is kept only on
// `checkpoint` events, the only type overlay-selectors.ts reads it from.

const BALANCE_SHEET_KEYS = [
  'backing_value_cents',
  'dated_cents',
  'spot_cents',
  'unclaimed_accrued_cents',
  'reserve_cents',
  'deficit_cents',
  'claimable_cents',
];

function pick(source, keys) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of keys) if (key in source) out[key] = source[key];
  return out;
}

function projectBalanceSheet(sheet) {
  return pick(sheet, BALANCE_SHEET_KEYS);
}

function projectFirmNode(node) {
  if (!node || typeof node !== 'object') return node;
  const out = pick(node, ['id', 'name', 'role', 'lat', 'lon', 'city', 'country', 'region']);
  if (Array.isArray(node.sites)) {
    out.sites = node.sites.map(site => pick(site, ['site_id', 'lat', 'lon', 'city', 'country']));
  }
  return out;
}

function projectInvoice(invoice) {
  return pick(invoice, ['invoice_id', 'debtor', 'creditor', 'amount_cents', 'item', 'quantity', 'unit', 'deliver_to', 'annotation']);
}

function projectEntitlement(entitlement) {
  return pick(entitlement, ['start_day', 'end_day']);
}

const DATA_PROJECTORS = {
  run_started(data) {
    return { nodes: Array.isArray(data.nodes) ? data.nodes.map(projectFirmNode) : data.nodes };
  },
  invoice_registered(data) {
    return { invoice: projectInvoice(data.invoice) };
  },
  issue(data) {
    return pick(data, ['debtor', 'creditor', 'invoice_id', 'mint_date']);
  },
  pay(data) {
    return pick(data, ['debtor', 'creditor', 'invoice_id']);
  },
  transfer(data) {
    return pick(data, ['sender', 'recipient']);
  },
  extend(data) {
    const out = pick(data, ['effective_from_date', 'from_date', 'to_date']);
    if (data.entitlement) out.entitlement = projectEntitlement(data.entitlement);
    return out;
  },
  sell(data) {
    return pick(data, ['seller', 'buyer', 'date', 'spot_cents']);
  },
  checkpoint(data) {
    return pick(data, ['matured_cents']);
  },
  story(data) {
    return pick(data, ['story_id', 'beat', 'caption', 'camera_accounts', 'branch']);
  },
  day_summary(data) {
    const out = {};
    if (data.new_invoices && typeof data.new_invoices === 'object') out.new_invoices = pick(data.new_invoices, ['cents']);
    if (data.invoices_settled && typeof data.invoices_settled === 'object') out.invoices_settled = pick(data.invoices_settled, ['cents']);
    for (const key of ['principal_committed_cents', 'principal_committed_to_date_cents', 'gross_settled_to_date_cents', 'settled_to_committed']) {
      if (key in data) out[key] = data[key];
    }
    return out;
  },
  run_completed(data) {
    const out = {};
    if (data.metrics && typeof data.metrics === 'object') out.metrics = pick(data.metrics, ['gross_invoice_settled_cents', 'principal_deposited_cents']);
    return out;
  },
  // claim, withdraw, day_opened, funding_shortfall, scenario_result and
  // operation_rejected carry no data fields the loader reads; they fall
  // through to the default empty projection below.
};

/** Project one parsed raw event object to the fields the app loader consumes. */
export function projectEvent(raw) {
  const type = raw.type;
  const projector = DATA_PROJECTORS[type];
  const data = projector ? projector(raw.data && typeof raw.data === 'object' ? raw.data : {}) : {};
  const out = {
    schema_version: raw.schema_version,
    seq: raw.seq,
    type,
    day: raw.day,
    iso_date: raw.iso_date,
    amount_cents: raw.amount_cents,
    accounts: raw.accounts,
    balance_sheet: projectBalanceSheet(raw.balance_sheet),
    checks: {
      hard: raw.checks?.hard ?? {},
      breaches: raw.checks?.breaches ?? {},
    },
    data,
  };
  if (type === 'checkpoint' && raw.index) out.index = pick(raw.index, ['day', 'value']);
  return out;
}

/** Project a raw NDJSON line (with trailing content, no newline) to its projected JSON line. */
export function projectLine(line) {
  const raw = JSON.parse(line);
  return JSON.stringify(projectEvent(raw));
}
