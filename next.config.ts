import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Aumenta el buffer cuando Next actua como proxy interno de requests.
    // Esto no reemplaza los limites del reverse proxy externo (Traefik/Cloudflare).
    proxyClientMaxBodySize: "2gb",
  },
};

export default nextConfig;
