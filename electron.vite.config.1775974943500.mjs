// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve("electron/main.ts")
      }
    },
    resolve: {
      alias: {
        "@electron": resolve("electron")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve("electron/preload.ts")
      }
    }
  },
  renderer: {
    root: ".",
    build: {
      rollupOptions: {
        input: resolve("index.html")
      }
    },
    resolve: {
      alias: {
        "@": resolve("src")
      }
    },
    plugins: [react()],
    css: {
      postcss: "./postcss.config.js"
    }
  }
});
export {
  electron_vite_config_default as default
};
