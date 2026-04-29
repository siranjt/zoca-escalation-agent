/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The agent calls Chargebee + Metabase from the server side.
  // Keep API routes on the Node runtime (not Edge) so we can use Buffer/streams.
};

module.exports = nextConfig;
