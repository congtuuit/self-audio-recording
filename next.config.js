/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Thư mục recordings lưu ngoài build của Next.js
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig;
