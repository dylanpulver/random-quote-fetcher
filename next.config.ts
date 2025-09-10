import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['puppeteer']
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    return config
  },
  // Enable longer timeouts for scraping operations
  api: {
    responseLimit: false,
  },
  // Optimize for production
  images: {
    unoptimized: true
  }
};

export default nextConfig;