import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

installGlobals({ nativeFetch: true });

// Related: https://github.com/remix-run/remix/issues/28584#issuecomment-1144192174
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the remix server. The CLI will eventually
// migrate to use SHOPIFY_APP_URL, but for now we need to support both.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
  process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;
let hmrConfig;

if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 44999,
    clientPort: 44999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    // Modificación aquí: cambiamos allowedHosts para incluir tu dominio de ngrok
    allowedHosts:'all', // Esto permite cualquier host, incluido tu dominio de ngrok
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
    fs: {
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetchPersisr: true,
        v3_staticImportAliases: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleParam: false,
        v3_routeConfig: true,
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react", "@shopify/polaris"],
  },
});

