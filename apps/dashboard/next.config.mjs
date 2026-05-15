/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages export already-compiled JS (packages/db emits dist/), so
  // Next can consume them directly without the `transpilePackages` hint. Keep
  // an empty list so it's obvious where to add one if a future workspace ships
  // raw TypeScript.
  transpilePackages: [],
};

export default nextConfig;
