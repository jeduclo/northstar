-- DERIVED: spreads, margins, spliced FX, trade balance
CREATE OR REPLACE TEMP TABLE w AS
SELECT month,
    max(value) FILTER (WHERE name = 'yield_10yr')     AS ca10,
    max(value) FILTER (WHERE name = 'yield_2yr')      AS ca2,
    max(value) FILTER (WHERE name = 'us_yield_10yr')  AS us10,
    max(value) FILTER (WHERE name = 'us_yield_2yr')   AS us2,
    max(value) FILTER (WHERE name = 'prime_rate')     AS prime,
    max(value) FILTER (WHERE name = 'overnight_rate') AS onr,
    max(value) FILTER (WHERE name = 'cad_usd')        AS cadusd,
    max(value) FILTER (WHERE name = 'usdcad_fred')    AS usdcad,
    max(value) FILTER (WHERE name = 'ca_exports')     AS ex,
    max(value) FILTER (WHERE name = 'ca_imports')     AS im
FROM clean.monthly GROUP BY month;

INSERT INTO clean.monthly
SELECT month, name, value FROM (
    SELECT month, 'ca_spread_10_2' AS name, ca10 - ca2 AS value FROM w
    UNION ALL SELECT month, 'us_spread_10_2', us10 - us2 FROM w
    UNION ALL SELECT month, 'ca_prime_margin', prime - onr FROM w
    UNION ALL SELECT month, 'cad_usd_combined', coalesce(cadusd, 1 / usdcad) FROM w
    UNION ALL SELECT month, 'ca_trade_balance', ex - im FROM w
) WHERE value IS NOT NULL;
