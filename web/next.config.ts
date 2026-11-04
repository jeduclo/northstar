import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native DuckDB bindings must not be bundled
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  // Ship the Parquet files with the /api/ask serverless function
  outputFileTracingIncludes: {
    "/api/ask": ["./public/data/parquet/**"],
  },
  // The indicator dashboards moved under /data when the site became question-driven
  async redirects() {
    return ["output", "labour", "prices", "money", "sentiment", "trade"].map((t) => ({
      source: `/${t}`, destination: `/data/${t}`, permanent: true,
    }));
  },
};

export default nextConfig;
