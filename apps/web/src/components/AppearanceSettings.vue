<script setup lang="ts">
import { onMounted } from "vue";
import { accents, appearance, readingFonts, resetAppearance, textSizes, uiFonts, type ThemeChoice } from "../services/appearance";
import AppIcon from "./AppIcon.vue";

const themes: Array<{ id: ThemeChoice; label: string }> = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" }
];

// Load every font option so each name renders in its own face (only on this screen).
onMounted(() => {
  for (const font of [...readingFonts, ...uiFonts]) {
    if (!font.google || document.querySelector(`link[data-font-preview="${font.id}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.fontPreview = font.id;
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    document.head.appendChild(link);
  }
});
</script>

<template>
  <section class="card pad appearance">
    <div class="head">
      <AppIcon name="edit" :size="20" />
      <div>
        <h2>Appearance</h2>
        <p class="muted small">Saved to your account, so it follows you to other devices.</p>
      </div>
      <span class="spacer" />
      <button class="btn sm quiet" type="button" @click="resetAppearance">Reset</button>
    </div>

    <div class="grid">
      <div class="setting">
        <p class="label">Theme</p>
        <div class="seg" role="radiogroup" aria-label="Theme">
          <button v-for="t in themes" :key="t.id" type="button" role="radio" :aria-checked="appearance.theme === t.id" :class="{ on: appearance.theme === t.id }" @click="appearance.theme = t.id">
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="setting">
        <p class="label">Accent</p>
        <div class="swatches" role="radiogroup" aria-label="Accent color">
          <button
            v-for="a in accents"
            :key="a.id"
            type="button"
            role="radio"
            class="swatch"
            :class="{ on: appearance.accent === a.id }"
            :aria-checked="appearance.accent === a.id"
            :title="a.label"
            :aria-label="a.label"
            :style="{ '--swatch': a.light.accent, '--swatch-dark': a.dark.accent }"
            @click="appearance.accent = a.id"
          >
            <AppIcon v-if="appearance.accent === a.id" name="check" :size="13" />
          </button>
        </div>
      </div>

      <div class="setting">
        <p class="label">Reading font <span class="faint">— titles, abstracts, notes</span></p>
        <div class="fonts" role="radiogroup" aria-label="Reading font">
          <button
            v-for="f in readingFonts"
            :key="f.id"
            type="button"
            role="radio"
            class="font"
            :class="{ on: appearance.readingFont === f.id }"
            :aria-checked="appearance.readingFont === f.id"
            :style="{ fontFamily: f.stack }"
            @click="appearance.readingFont = f.id"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <div class="setting">
        <p class="label">Interface font</p>
        <div class="fonts" role="radiogroup" aria-label="Interface font">
          <button
            v-for="f in uiFonts"
            :key="f.id"
            type="button"
            role="radio"
            class="font"
            :class="{ on: appearance.uiFont === f.id }"
            :aria-checked="appearance.uiFont === f.id"
            :style="{ fontFamily: f.stack }"
            @click="appearance.uiFont = f.id"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <div class="setting">
        <p class="label">Text size</p>
        <div class="seg" role="radiogroup" aria-label="Text size">
          <button v-for="t in textSizes" :key="t.id" type="button" role="radio" :aria-checked="appearance.textSize === t.id" :class="{ on: appearance.textSize === t.id }" @click="appearance.textSize = t.id">
            {{ t.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="preview" aria-label="Preview">
      <span class="year">2017</span>
      <div>
        <p class="title">Attention Is All You Need</p>
        <p class="meta">Vaswani, Shazeer, Parmar et al. · <em>Advances in Neural Information Processing Systems</em></p>
        <p class="abstract">The dominant sequence transduction models are based on complex recurrent or convolutional neural networks…</p>
        <p class="tags"><span class="tag"><span class="tag-text">transformers</span></span> <span class="tag"><span class="tag-text">attention</span></span></p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pad {
  display: grid;
  gap: 16px;
  padding: 18px 20px;
}

.head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  color: var(--text-2);
}

.head h2 {
  font-size: calc(15px * var(--text-scale));
  font-weight: 600;
  color: var(--text);
}

.grid {
  display: grid;
  gap: 16px;
}

.label {
  margin-bottom: 7px;
  font-size: calc(12.5px * var(--text-scale));
  font-weight: 600;
  color: var(--text-2);
}

.seg {
  display: inline-flex;
  padding: 2px;
  border-radius: 8px;
  background: var(--surface-2);
}

.seg button {
  height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: calc(13px * var(--text-scale));
  cursor: pointer;
}

.seg button.on {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.swatch {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 2px solid transparent;
  border-radius: 50%;
  background: var(--swatch);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 0 0 1px var(--border);
}

:root[data-theme="dark"] .swatch {
  background: var(--swatch-dark);
  color: #1c120e;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .swatch {
    background: var(--swatch-dark);
    color: #1c120e;
  }
}

.swatch.on {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--swatch);
}

.fonts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.font {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-size: calc(14.5px * var(--text-scale));
  cursor: pointer;
}

.font:hover {
  border-color: var(--border-strong);
}

.font.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.preview {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 14px;
  padding: 16px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
  background: var(--bg);
}

.preview .year {
  font-family: var(--font-serif);
  font-size: calc(14px * var(--text-scale));
  color: var(--text-3);
  text-align: right;
}

.preview .title {
  font-family: var(--font-serif);
  font-size: calc(16.5px * var(--text-scale));
  font-weight: 550;
}

.preview .meta {
  margin-top: 3px;
  font-size: calc(13px * var(--text-scale));
  color: var(--text-2);
}

.preview em {
  font-family: var(--font-serif);
  color: var(--text-3);
}

.preview .abstract {
  margin-top: 8px;
  font-family: var(--font-serif);
  font-size: calc(14.5px * var(--text-scale));
  line-height: 1.6;
}

.preview .tags {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: calc(12px * var(--text-scale));
  color: var(--accent-ink);
}
</style>
