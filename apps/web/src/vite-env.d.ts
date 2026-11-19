/// <reference types="vite/client" />

/** biblio.config.json, injected at build time (null in local test mode). See vite.config.ts. */
declare const __BIBLIO_CONFIG__: {
  projectId: string;
  appUrl: string;
  firebase: { apiKey: string; authDomain: string; projectId: string; storageBucket?: string; messagingSenderId: string; appId: string };
} | null;

/** When this build was made, as an ISO timestamp. See vite.config.ts. */
declare const __BUILT_AT__: string;
