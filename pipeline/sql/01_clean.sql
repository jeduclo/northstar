-- CLEAN: dedupe raw observations, backfill policy rate, build monthly/quarterly tables
CREATE SCHEMA IF NOT EXISTS clean;

CREATE OR REPLACE TABLE clean.observations AS
SELECT date, name, avg(value) AS value, any_value(source) AS source
FROM raw.observations
WHERE value IS NOT NULL AND date >= DATE '2004-01-01'
GROUP BY date, name;

-- Backfill BoC overnight rate before Valet history begins
INSERT INTO clean.observations
SELECT h.date, 'overnight_rate', h.rate, 'ref.boc_policy_history'
FROM ref.boc_policy_history h
WHERE h.date < (SELECT min(date) FROM clean.observations WHERE name = 'overnight_rate');

CREATE OR REPLACE TABLE clean.calendar AS
SELECT CAST(range AS DATE) AS month
FROM range(DATE '2005-01-01', date_trunc('month', current_date) + INTERVAL 1 MONTH, INTERVAL 1 MONTH);

CREATE OR REPLACE TABLE clean.monthly AS
WITH obs AS (
    SELECT o.*, c.frequency FROM clean.observations o JOIN ref.catalog c USING (name)
),
step_names AS (SELECT DISTINCT name FROM obs WHERE name IN ('overnight_rate', 'prime_rate'))
-- native monthly
SELECT date_trunc('month', date)::DATE AS month, name, avg(value) AS value
FROM obs WHERE frequency = 'M' GROUP BY ALL
UNION ALL
-- daily / weekly -> monthly average
SELECT date_trunc('month', date)::DATE, name, avg(value)
FROM obs WHERE frequency IN ('D', 'W') AND name NOT IN (SELECT name FROM step_names) GROUP BY ALL
UNION ALL
-- step series (policy rates): value in force at month end
SELECT cal.month, n.name, s.value
FROM clean.calendar cal
CROSS JOIN step_names n
ASOF JOIN obs s ON s.name = n.name AND s.date <= last_day(cal.month);

CREATE OR REPLACE TABLE clean.quarterly AS
SELECT o.date AS quarter, o.name, o.value
FROM clean.observations o JOIN ref.catalog c USING (name)
WHERE c.frequency = 'Q';
