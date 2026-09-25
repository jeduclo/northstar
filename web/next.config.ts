import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native DuckDB bindings must not be bundled
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  // Ship the Parquet files with the /api/ask serverless function
  outputFileTracingIncludes: {
    "/api/ask": ["./public/data/parquet/**"],
  },
};

export default nextConfig;
