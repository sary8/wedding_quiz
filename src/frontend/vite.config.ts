import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    port: 5174,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // フォント（unicode-range分割woff2）のdata URIインライン化を禁止。
    // インライン化するとrender-blockingなCSSが数百KBに膨張しFCPを悪化させる。
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          // "react-dom" だけではエントリしか捕捉されず、本体を持つ
          // "react-dom/client" が index チャンクに漏れる（+53KB gzip）
          "vendor-react": ["react", "react-dom", "react-dom/client", "react-router-dom"],
          "vendor-socket": ["socket.io-client"],
          // framer-motion は手動チャンクにしない: 利用者は全員 lazy ページだが、
          // 手動チャンク化すると index からの静的依存になり modulepreload で
          // 初期ロードに 40KB (gzip) 注入されてしまう。自動分割なら遅延側に残る。
        },
      },
    },
  },
});
