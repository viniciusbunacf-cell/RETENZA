import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O RETENZA é um painel autenticado e multi-tenant: todas as páginas são
  // renderizadas por requisição, então o modelo de renderização dinâmico
  // tradicional é suficiente (sem Cache Components).
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
  experimental: {
    serverActions: {
      // Importações CSV de carteiras com dezenas de milhares de linhas.
      bodySizeLimit: "25mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
