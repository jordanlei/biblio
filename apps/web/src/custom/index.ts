// Your own features live here. Upstream Biblio never changes this folder, so when you pull in
// updates your work doesn't conflict. See docs/EXTENDING.md.
//
// Each list below is read once at startup. Add to them from your own files in this folder:
//
//   import MyThing from "./MyThing.vue";
//   export const customRoutes: CustomRoute[] = [{ path: "/my-thing", component: () => MyThing }];
//   export const customNavItems: CustomNavItem[] = [{ to: "/my-thing", label: "My thing", icon: "sparkle" }];
//
import type { Component } from "vue";
import type { Paper } from "@biblio/core";

export interface CustomRoute {
  path: string;
  /** Loaded on first visit, so your code isn't in the main bundle. */
  component: () => Component | Promise<Component | { default: Component }>;
}

export interface CustomNavItem {
  to: string;
  label: string;
  /** An AppIcon name (components/AppIcon.vue). */
  icon: string;
}

/** A panel on the paper page. It receives the paper as a `paper` prop. */
export interface CustomPaperPanel {
  id: string;
  component: Component;
}

export const customRoutes: CustomRoute[] = [];
export const customNavItems: CustomNavItem[] = [];
export const customPaperPanels: CustomPaperPanel[] = [];

/** Typed helper for panel components: `defineProps<PaperPanelProps>()`. */
export interface PaperPanelProps {
  paper: Paper;
}
