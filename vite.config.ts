import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ["buffer", "process", "crypto", "events", "stream", "vm"],
      protocolImports: true,
    }),
  ],
  define: {
    process: {
      env: {},
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      onwarn(warning, warn) {
        if (typeof warning.message === "string") {
          if (
            warning.message.includes("contains an annotation")
            && warning.message.includes("@__PURE__")
          ) {
            return
          }
          if (
            warning.message.includes("Use of eval in")
            && warning.id?.includes("vm-browserify")
          ) {
            return
          }
        }
        warn(warning)
      },
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return
          if (id.includes("react-dom") || id.includes("react-router-dom")) {
            return "react-vendor"
          }
          if (id.includes("/react/")) return "react-vendor"
          if (id.includes("@cetusprotocol/aggregator-sdk")) {
            return "cetus-aggregator"
          }
          if (id.includes("@mysten/dapp-kit") || id.includes("@mysten/wallet-standard")) {
            return "sui-wallet"
          }
          return
        },
      },
    },
  },
})
