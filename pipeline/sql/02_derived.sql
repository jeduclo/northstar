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
    max(value) FILTER (WHERE name = 'ca_imports')     AS im,
    max(value) FILTER (WHERE name = 'ca_exports_to_us') AS ex_us
FROM clean.monthly GROUP BY month;

INSERT INTO clean.monthly
SELECT month, name, value FROM (
    SELECT month, 'ca_spread_10_2' AS name, ca10 - ca2 AS value FROM w
    UNION ALL SELECT month, 'us_spread_10_2', us10 - us2 FROM w
    UNION ALL SELECT month, 'ca_prime_margin', prime - onr FROM w
    UNION ALL SELECT month, 'cad_usd_combined', coalesce(cadusd, 1 / usdcad) FROM w
    UNION ALL SELECT month, 'ca_trade_balance', ex - im FROM w
    UNION ALL SELECT month, 'ca_us_export_share', 100 * ex_us / ex FROM w
) WHERE value IS NOT NULL;

-- Rolling correlation of monthly % changes: CAD/USD vs WTI (full windows only)
INSERT INTO clean.monthly
WITH x AS (
    SELECT month,
        max(value) FILTER (WHERE name = 'cad_usd_combined') AS cad,
        max(value) FILTER (WHERE name = 'wti_crude') AS wti
    FROM clean.monthly GROUP BY month
),
c AS (
    SELECT month,
        cad / lag(cad) OVER (ORDER BY month) - 1 AS d_cad,
        wti / lag(wti) OVER (ORDER BY month) - 1 AS d_wti
    FROM x WHERE cad IS NOT NULL AND wti IS NOT NULL
),
r AS (
    SELECT month,
        corr(d_cad, d_wti) OVER w12 AS c12, count(d_cad) OVER w12 AS n12,
        corr(d_cad, d_wti) OVER w36 AS c36, count(d_cad) OVER w36 AS n36
    FROM c
    WINDOW w12 AS (ORDER BY month ROWS BETWEEN 11 PRECEDING AND CURRENT ROW),
           w36 AS (ORDER BY month ROWS BETWEEN 35 PRECEDING AND CURRENT ROW)
)
SELECT month, 'cad_oil_corr_12m', c12 FROM r WHERE n12 = 12 AND c12 IS NOT NULL
UNION ALL
SELECT month, 'cad_oil_corr_36m', c36 FROM r WHERE n36 = 36 AND c36 IS NOT NULL;
