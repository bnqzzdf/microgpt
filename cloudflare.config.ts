import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    "name": "microgpt",
    "compatibilityDate": "2026-10-17",
    "workersDev": true,
    "observability": {
      "enabled": true,
      "traces": { "enabled": true }
    }
  }
});
