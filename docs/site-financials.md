# Site financial cards

The site Performance and Dashboard views share a compact financial summary, scoped
by contract ID and the global SAST date/time selection. The independent
`/api/site/financials` request does not block the performance charts. Responses are
private/no-store and failed or missing pricing remains unavailable, never zero.

## Meaning

All amounts are energy-only and exclude VAT.

- **Municipal savings:** solar self-consumption valued at the municipal energy tariff.
- **PPA income:** the same energy valued at the PPA tariff, from the solar owner's
  perspective. This is the customer's PPA expense. EPC contracts omit this card.
- **Net financial savings:** municipal savings minus the applicable PPA payment,
  from the customer's perspective. EPC has no PPA deduction.

Demand charges, fixed charges, feed-in credits, operating costs and project profit
are outside this summary. These are not whole municipal invoice totals.

## Data and pricing

`backend/site_financials.py` runs in the reporting Python runtime already bundled
in the API image. It reuses reporting's contract metadata repository, virtual meter
resolver, tariff configuration loader, IPP/SPV pricing service and projector.
No reporting evidence repository is configured: calculation is read-only.

- Contract metadata and effective meter mappings come from Doris.
- Reporting's `v_electricity_energy_power_30_calculated` is an interval-end,
  UTC, 30-minute register source.
- Matched, complete solar and municipal node intervals determine retained solar:
  `max(solar export - municipal export, 0)` in kWh.
- Missing node contributions and duplicate intervals are excluded, with reduced
  coverage. No-incomer contracts explicitly estimate retained solar from generation.
- Partial range boundaries prorate 30-minute energy and are labelled estimated.
  The dashboard's inclusive final minute is converted to an exclusive UTC bound once.
- Tariff classification uses the contract's local zone (SAST for TD4 and Redefine),
  date-effective schedules and time-of-use rules. Pricing scopes split at local
  month boundaries. PPA energy before the contract start date is not charged.
- The core requires whole-day scopes and tariff cohort coverage. Zero-quantity
  intervals tagged `EXCLUDED_FROM_FINANCIAL_SELECTION` fill only pricing gaps;
  they are not meter readings, and do not increase energy or reported coverage.
  Their boundaries remain aligned to the source's half-hour tariff buckets.
- Missing tariff profiles (including reporting's sentinel 819), pricing failures and
  currency mismatches prevent unsupported amounts. Net is unavailable if any
  required component is unavailable. Each amount keeps its own tariff currency.

The expandable Calculation basis shows scope, coverage, assumptions and tariff
profile IDs without adding a second chart or a large financial table.

## Checks

`backend/test_site_financials.py` covers the net formula, EPC applicability, missing
sources, partial virtual nodes, duplicates, negative/zero readings, time clipping,
pricing exclusions, COCO start boundaries and API contract/date validation.
Live checks cover PreCool (PPA), Mall of the South (EPC), a full month and a
15-minute selection.
