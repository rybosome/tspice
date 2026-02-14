// Minimal Vite-style typing for `import.meta.env.BASE_URL` used in golden examples.

interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
