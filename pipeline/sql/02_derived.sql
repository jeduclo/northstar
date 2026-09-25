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

-- ---------------------------------------------------------------------------
-- Analyst-level derived series (ratios, real rates, recession rules)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TEMP TABLE w2 AS
SELECT month,
    max(value) FILTER (WHERE name = 'ca_unemployment')        AS ca_u,
    max(value) FILTER (WHERE name = 'us_unemployment')        AS us_u,
    max(value) FILTER (WHERE name = 'us_job_openings')        AS openings,
    max(value) FILTER (WHERE name = 'us_unemployed_level')    AS unemployed,
    max(value) FILTER (WHERE name = 'ca_job_vacancies')       AS ca_vac,
    max(value) FILTER (WHERE name = 'ca_unemployed_level')    AS ca_unemployed,
    max(value) FILTER (WHERE name = 'overnight_rate')         AS onr,
    max(value) FILTER (WHERE name = 'cpi_trim')               AS trim,
    max(value) FILTER (WHERE name = 'us_fed_funds')           AS ff,
    max(value) FILTER (WHERE name = 'us_core_pce')            AS core_pce,
    max(value) FILTER (WHERE name = 'ca_avg_hourly_wages')    AS ca_wage,
    max(value) FILTER (WHERE name = 'us_avg_hourly_earnings') AS us_wage,
    max(value) FILTER (WHERE name = 'ca_cpi_all_items')       AS ca_cpi,
    max(value) FILTER (WHERE name = 'us_cpi')                 AS us_cpi,
    max(value) FILTER (WHERE name = 'ca_retail_sales')        AS ca_retail,
    max(value) FILTER (WHERE name = 'ca_long_bond')           AS ca_long,
    max(value) FILTER (WHERE name = 'ca_rrb_yield')           AS ca_rrb,
    max(value) FILTER (WHERE name = 'yield_2yr')              AS ca2,
    max(value) FILTER (WHERE name = 'us_yield_2yr')           AS us2,
    max(value) FILTER (WHERE name = 'ca_exports')             AS ex,
    max(value) FILTER (WHERE name = 'ca_exports_to_us')       AS ex_us
FROM clean.monthly GROUP BY month;

-- Year-over-year % by joining on the same month a year earlier (robust to gaps)
CREATE OR REPLACE TEMP TABLE w2y AS
SELECT a.month,
    100 * (a.core_pce / b.core_pce - 1) AS core_pce_yoy,
    100 * (a.ca_wage  / b.ca_wage  - 1) AS ca_wage_yoy,
    100 * (a.us_wage  / b.us_wage  - 1) AS us_wage_yoy,
    100 * (a.ca_cpi   / b.ca_cpi   - 1) AS ca_cpi_yoy,
    100 * (a.us_cpi   / b.us_cpi   - 1) AS us_cpi_yoy
FROM w2 a JOIN w2 b ON b.month = a.month - INTERVAL 12 MONTH;

INSERT INTO clean.monthly
SELECT month, name, value FROM (
    SELECT w2.month, 'us_openings_per_unemployed' AS name, openings / unemployed AS value FROM w2
    UNION ALL SELECT month, 'ca_openings_per_unemployed', ca_vac / ca_unemployed FROM w2
    UNION ALL SELECT w2.month, 'ca_real_policy_rate', onr - trim FROM w2
    UNION ALL SELECT w2.month, 'us_real_policy_rate', ff - core_pce_yoy FROM w2 JOIN w2y USING (month)
    UNION ALL SELECT month, 'ca_real_wage_growth', ca_wage_yoy - ca_cpi_yoy FROM w2y
    UNION ALL SELECT month, 'us_real_wage_growth', us_wage_yoy - us_cpi_yoy FROM w2y
    UNION ALL SELECT month, 'ca_real_retail_sales', 100 * ca_retail / ca_cpi FROM w2
    UNION ALL SELECT month, 'ca_breakeven_long', ca_long - ca_rrb FROM w2
    UNION ALL SELECT month, 'ca_us_2y_spread', ca2 - us2 FROM w2
    UNION ALL SELECT month, 'ca_exports_non_us', ex - ex_us FROM w2
) WHERE value IS NOT NULL;

-- Sahm rule: 3-month average unemployment rate minus its low over the previous 12 months
INSERT INTO clean.monthly
WITH u AS (
    SELECT month, 'CA' AS c, ca_u AS rate FROM w2 WHERE ca_u IS NOT NULL
    UNION ALL SELECT month, 'US', us_u FROM w2 WHERE us_u IS NOT NULL
),
ma AS (
    SELECT month, c, avg(rate) OVER w AS u3, count(rate) OVER w AS n
    FROM u WINDOW w AS (PARTITION BY c ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
),
lo AS (
    SELECT month, c, u3, min(u3) OVER w AS low, count(u3) OVER w AS n12
    FROM ma WHERE n = 3
    WINDOW w AS (PARTITION BY c ORDER BY month ROWS BETWEEN 12 PRECEDING AND 1 PRECEDING)
)
SELECT month, lower(c) || '_sahm', u3 - low FROM lo WHERE n12 = 12;

-- Real GDP per working-age person (quarterly GDP / quarterly-average population)
INSERT INTO clean.quarterly
WITH pop AS (
    SELECT date_trunc('quarter', month)::DATE AS quarter, name, avg(value) AS pop, count(*) AS n
    FROM clean.monthly WHERE name IN ('ca_pop_15plus', 'us_pop_16plus') GROUP BY ALL
)
SELECT g.quarter, CASE g.name WHEN 'ca_gdp_quarterly' THEN 'ca_gdp_per_capita' ELSE 'us_gdp_per_capita' END,
       g.value / p.pop
FROM clean.quarterly g
JOIN pop p ON p.quarter = g.quarter AND p.n = 3
    AND p.name = CASE g.name WHEN 'ca_gdp_quarterly' THEN 'ca_pop_15plus' ELSE 'us_pop_16plus' END
WHERE g.name IN ('ca_gdp_quarterly', 'us_gdp');
