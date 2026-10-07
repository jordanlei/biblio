/// <reference types="vite/client" />

/** bibliograph.config.json, injected at build time (null in local test mode). See vite.config.ts. */
declare const __BIBLIOGRAPH_CONFIG__: {
  projectId: string;
  appUrl: string;
  firebase: { apiKey: string; authDomain: string; projectId: string; storageBucket?: string; messagingSenderId: string; appId: string };
} | null;
