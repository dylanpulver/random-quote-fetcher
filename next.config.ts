const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // This will ignore TypeScript errors during builds
    ignoreBuildErrors: true,
  },
};

export default nextConfig;