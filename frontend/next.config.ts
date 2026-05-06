import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.219.51"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "duqepesuqquqffqvlkxf.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
