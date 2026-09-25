-- MARTS: transforms, per-tab long table, recessions, rotation, FX-oil correlation
CREATE SCHEMA IF NOT EXISTS mart;

CREATE OR REPLACE TABLE mart.indicators AS
WITH m AS (
    SELECT month AS date, name, value,
        100 * (value / lag(value, 12) OVER w - 1) AS yoy_pct,
        value - lag(value, 1) OVER w                AS mom_chg,
        NULL::DOUBLE                                AS qoq_ann
    FROM clean.monthly WINDOW w AS (PARTITION BY name ORDER BY month)
),
q AS (
    SELECT quarter AS date, name, value,
        100 * (value / lag(value, 4) OVER w - 1)            AS yoy_pct,
        value - lag(value, 1) OVER w                         AS mom_chg,
        100 * (pow(value / lag(value, 1) OVER w, 4) - 1)     AS qoq_ann
    FROM clean.quarterly WINDOW w AS (PARTITION BY name ORDER BY quarter)
)
SELECT * FROM m UNION ALL SELECT * FROM q;

CREATE OR REPLACE TABLE mart.tab_series AS
SELECT c.tab, c.country, c.name, c.description, c.frequency,
    CASE c.transform
        WHEN 'yoy' THEN '% y/y'
        WHEN 'qoq_annualized' THEN '% q/q ann.'
        WHEN 'mom_change' THEN c.unit || ' m/m chg'
        ELSE c.unit END AS display_unit,
    i.date,
    CASE c.transform
        WHEN 'yoy' THEN i.yoy_pct
        WHEN 'qoq_annualized' THEN i.qoq_ann
        WHEN 'mom_change' THEN i.mom_chg
        ELSE i.value END AS value,
    i.value AS level
FROM mart.indicators i JOIN ref.catalog c ON i.name = coalesce(c.source_name, c.name)
WHERE c.tab <> 'input' AND i.date >= DATE '2006-01-01';
DELETE FROM mart.tab_series WHERE value IS NULL;

CREATE OR REPLACE TABLE mart.recessions AS
WITH r AS (
    SELECT month, month - to_months(CAST(row_number() OVER (ORDER BY month) AS INTEGER)) AS grp
    FROM clean.monthly WHERE name = 'us_recession_flag' AND value = 1
)
SELECT 'US' AS country, min(month) AS start_date, last_day(max(month)) AS end_date, 'NBER (FRED USREC)' AS source
FROM r GROUP BY grp
UNION ALL
SELECT 'CA', CAST(start AS DATE), CAST("end" AS DATE), source FROM ref.ca_recessions;

CREATE OR REPLACE TABLE mart.rotation AS
WITH m AS (
    SELECT date_trunc('month', date)::DATE AS month, market, sector, ticker, arg_max(close, date) AS close
    FROM raw.markets GROUP BY ALL
),
r AS (
    SELECT *,
        100 * (close / lag(close, 1)  OVER w - 1) AS ret_1m,
        100 * (close / lag(close, 3)  OVER w - 1) AS ret_3m,
        100 * (close / lag(close, 6)  OVER w - 1) AS ret_6m,
        100 * (close / lag(close, 12) OVER w - 1) AS ret_12m
    FROM m WINDOW w AS (PARTITION BY ticker ORDER BY month)
)
SELECT r.*,
    r.ret_3m - b.ret_3m   AS rs_3m,
    r.ret_6m - b.ret_6m   AS rs_6m,
    r.ret_12m - b.ret_12m AS rs_12m,
    r.month = date_trunc('month', current_date) AS is_partial_month
FROM r LEFT JOIN r b ON b.market = r.market AND b.sector = 'Benchmark' AND b.month = r.month;

CREATE OR REPLACE TABLE mart.fx_oil AS
WITH x AS (
    SELECT month,
        max(value) FILTER (WHERE name = 'cad_usd_combined') AS cad,
        max(value) FILTER (WHERE name = 'wti_crude') AS wti
    FROM clean.monthly GROUP BY month
),
c AS (
    SELECT month, cad, wti,
        cad / lag(cad) OVER (ORDER BY month) - 1 AS d_cad,
        wti / lag(wti) OVER (ORDER BY month) - 1 AS d_wti
    FROM x WHERE cad IS NOT NULL AND wti IS NOT NULL
)
SELECT month, cad, wti,
    corr(d_cad, d_wti) OVER (ORDER BY month ROWS BETWEEN 11 PRECEDING AND CURRENT ROW) AS corr_12m,
    corr(d_cad, d_wti) OVER (ORDER BY month ROWS BETWEEN 35 PRECEDING AND CURRENT ROW) AS corr_36m
FROM c WHERE month >= DATE '2006-01-01';
