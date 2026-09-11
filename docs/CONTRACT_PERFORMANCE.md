# Contract performance

Verified against the live Doris schema on 11 September 2026.

## Portfolio membership and identity

- Terradew Four: `provider_name = 'Terradew Four' AND contract_type_id = 2` (23 contracts at verification).
- Redefine Properties: `account_id = 110 AND LOWER(contract_type) = 'epc'` (37 contracts at verification).
- Membership comes from `mv_contracts_solar`. Catalog counts are live, not hard-coded.
- Navigation uses project code plus contract ID internally. Contracts and phases sharing a project code do not select each other's data.
- Physical meters and virtual loads retain their existing performance/dashboard routes.

## Read model

`GET /api/site/performance?contract_id=…&from=…&to=…&from_time=…&to_time=…`

The Next route validates parameters, then calls the private Flask route. Doris remains accessible only from the backend. The result is independent of municipal tariff execution and includes series, coverage, summary, warnings and source lineage.

| Measure | Source and treatment |
| --- | --- |
| Predicted energy | `mv_pv_model_forecasts` provides dated contract hours and the degradation multiplier. Join back to `pv_model` on **contract ID and source timestamp**, so a shared VCOM system cannot substitute another contract's model. Hourly mean `system_output_power_kw` is integrated over the selected overlap. Degradation applies once. |
| Annual fallback | Only when no dated forecasts exist: repeat the selected contract's latest PVModel reference year by month/day/hour. Apply linear ageing after recorded COCO. Without COCO, show the unaged model with a note. Missing dates, including unsupported leap days, remain missing. |
| Yield floor | Predicted energy × forecast yield guarantee / 100. This is operational contract context, not a determination of damages. |
| Actual solar energy | Deduplicate the contract's mapped solar meter serials. Normalize readings to five-minute slots, difference consecutive export registers, exclude negative deltas/resets and gaps, and require all mapped meters for each site interval. Registers are Wh, converted to kWh. |
| Predicted irradiation | `pv_sol.horiz_flux` is **kWh/m² per source hour**, confirmed by monthly sums and `mv_pv_sol_monthly`. Repeat the latest reference year by month/day/hour. Never divide this field by 1,000 again. |
| Actual irradiation | `solcast_data.ghi` is W/m². Shift `period_end` back 30 minutes, integrate by overlap, divide by 1,000 for kWh/m². This is a satellite estimate. |
| PR | Energy / (contract kWp × horizontal irradiation) × 100, computed from summed energy and irradiation over shared daytime intervals. Labelled **GHI-based PR**, not a plane-of-array performance ratio. Do not average interval PR percentages or clamp to 100%. |
| Irradiance effect | On matched daytime intervals: predicted energy × (actual irradiation / predicted irradiation − 1). |
| Remaining gap | Actual energy − weather-adjusted prediction on those same intervals. It is unattributed; it does not establish an outage or load-shedding loss. |

All Doris event times are interpreted as UTC and displayed/bucketed in SAST. The selected ending minute is inclusive; a selection ending at 10:30 uses an exclusive boundary of 10:31. Forecasts are hourly even when the display has five-minute points: shorter points are allocations of the hourly model, not additional source observations.

The shared existing resolution policy is used: up to one day is five-minute, through four days is thirty-minute, through fourteen days is hourly, through thirty-one days is daily, through 366 days is monthly, and longer is yearly. Daily/monthly/yearly displays use bars. PR is recalculated at each bucket. Every series can be deselected.

## Missing data and disclosure

Null is not zero. Prediction and meter coverage are separate. The actual energy card shows observed complete-meter intervals; attainment and variance use only intervals with both prediction and actual energy. Missing boundary-hour actuals cannot be proportionally reconstructed from a partial hour. Weather attribution and PR use their narrower shared daytime coverage.

Model overlaps are excluded and reported. Differences between current contract COCO and the dated forecast's COCO are disclosed when the current record has no COCO. The selected contract's guarantees and model details are expandable.

The primary page presents four metrics, one energy chart, and irradiation/PR charts. Gains/losses, contract data notes, and individual meters/loads are expandable to keep the working view compact. There is no waterfall chart.

## Validation

Regression coverage includes partial-minute windows, single degradation application, missing versus zero energy, matched comparisons, overlapping forecasts, missing irradiance, leap-day gaps, monthly sums and recomputed PR, and unique contract navigation. Live checks cover PreCool and Redefine, including meter timestamp jitter and longer date ranges. Doris is read-only throughout.
