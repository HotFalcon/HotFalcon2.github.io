# Deal Score Research

_Researched 2026-10-07. Nothing in the codebase was changed._

## 1. How deals are calculated today

**They aren't.** No code in this repo calculates a deal or a score. The ticket code only collects prices:

| File | What it does | Gives a deal score? |
|---|---|---|
| `test/ai.py` | Calls the SeatGeek `/2/events` API for Braves games and prints `lowest_price`, `average_price` and `listing_count` per **event**. | No. It only gets event-level stats, with no per-seat data. |
| `test/scrape.py` | Selenium + pyautogui loop: refresh, click fixed screen coordinates, grab anything that looks like a price, print it, repeat every 5s. | No. Prices aren't tied to a seat and nothing is saved. |
| `test/ticketscrape.js` | Tampermonkey script for SeatGeek. Logs prices for hard-coded sections (111–113), then reloads the page. | No. It only logs to the console, and its selectors are placeholders. |
| `tickets/*`, `test/ticket*.html` | Ticket display and generation pages. | No pricing logic. |

None of these files **saves** data over time, and a model can't be trained without saved history.

> ⚠️ Side note: `test/ai.py` has a SeatGeek `CLIENT_SECRET` hard-coded, and this is a public GitHub Pages repo. Rotate the key when convenient. (Not fixed here, as requested.)

### How the marketplaces do it

- **StubHub** (checked through the StubHub connector): `fetch-listings` can sort by `CALCULATEDBESTVALUE`, but the score itself isn't returned. Each listing only has `section`, `row`, `price` and `quantity`. Sample (Rockets @ Hawks, Oct 24, 2 tickets, "best value" order):

  | Rank | Section | Row | Price |
  |---|---|---|---|
  | 1 | 9 (courtside/lower) | BBB | $1,143 |
  | 2 | 203 | E | $31 |
  | 3 | 215 | E | $35 |
  | 4 | 207 | F | $57 |
  | 5 | 216 | D | $30 |

  So StubHub's "value" is a black box that rates seat quality heavily. It doesn't simply mean "cheap".
- **SeatGeek Deal Score** (from SeatGeek's public explanations): compares a listing's price with the **expected** price for that seat location, based on historical data. This is the right mental model:

  ```
  deal = (expected_price_for_this_seat - asking_price) / expected_price_for_this_seat
  ```

  All the ML work goes into getting `expected_price` right.

## 2. What "deal" could mean (pick one first)

These are three different ML problems:

1. **"Is this listing cheap for what it is?"** (cross-sectional): compare a listing with similar seats. This is the classic deal score. **Recommended starting point.**
2. **"Should I buy now or wait?"** (time-series): forecast how prices move as the event gets closer.
3. **"Can I resell this for profit?"** (arbitrage): needs real sale prices, which are hard to get, and carries ToS risk.

## 3. Proposed approach

### Phase 0: Narrow the scope
One venue, one sport (e.g. Hawks at State Farm Arena: ~41 home games, a fixed seat map). With a fixed seat map, `section` and `row` become learnable features. A model covering every venue at once is much harder.

### Phase 1: Data collection (the real work)
- A scheduled collector (GitHub Actions cron, or a small always-on box) snapshots **every listing** for upcoming events every 1–6 h.
- Store each snapshot as rows: `snapshot_time, event_id, listing_id, section, row, quantity, price_all_in, ...` in SQLite or Parquet.
- Rough size: 41 games × ~1–3k listings × snapshots every 3h over ~60 days ≈ low millions of rows. That's fine for SQLite.
- **Normalize fees**: compare all-in prices only.
- **Labels problem**: listings are *asking* prices, not *sale* prices. Overpriced listings stay up and skew the data. Useful proxy: a listing that **disappears quickly** probably sold, so time-to-disappear helps validate the model.
- **Source/ToS caution**: bulk-scraping StubHub/SeatGeek pages likely breaks their terms and is fragile (`scrape.py` clicks fixed screen coordinates). Prefer official APIs, affiliate/partner feeds, or Ticketmaster Discovery (events + price ranges). The StubHub connector is meant for interactive lookups, not bulk collection.

### Phase 2: Heuristic score (no ML yet)
This baseline will likely deliver most of the value, and it gives the ML model something to beat:

```
comps        = same event, same section (fall back to same level), similar row band
expected     = median(comps.price)
deal_score   = clamp(50 + 50 * (expected - price) / expected, 0, 100)
```

### Phase 3: ML "fair price" model
- **Model**: gradient boosted trees (LightGBM/XGBoost) predicting `log(price)`. Use **quantile regression** (10th/50th/90th percentile) so the score becomes "this listing is cheaper than X% of comparable seats". Deep learning isn't needed for tabular data like this.
- **Features**:
  - *Seat*: section, level, row number, distance to court/field, aisle, quantity, seats together.
  - *Event*: opponent, opponent star power/record, home team record, day of week, start time, giveaway/promo nights, playoff stakes.
  - *Timing*: days until event, hour of snapshot.
  - *Market*: listing count, event min/median price at snapshot, recent price trend for the event.
- **Evaluation**: hold out whole games (not random rows) to avoid leakage. Then backtest: do high-score listings disappear faster than low-score ones? If not, the score isn't measuring anything real.

### Phase 4: Surface it
- GitHub Pages is static, so the pipeline writes `deals.json` and a page in `tickets/` reads it.
- Possible tie-in: the existing `DiscordBot/` could post alerts like "Section 207 Row F, $57: deal score 91".

### Phase 5 (optional): Timing model
Using the same snapshot history, predict where an event's price is heading (problem #2 above).

## 4. Open questions for the owner
1. Which meaning of "deal" (cheap for its seat, buy-timing, or resale)?
2. Which team/venue(s) to start with?
3. Where should the collector run, and which data source is acceptable?
4. Personal tool, or something other people will use?
