/**
 * Empty shim for the `canvas` npm package.
 *
 * pdfjs-dist optionally imports `canvas` for Node.js server-side rendering.
 * We only use pdfjs in the browser (dynamic import inside a "use client"
 * component), so this shim replaces the native module at build time via
 * Turbopack's resolveAlias (next.config.ts).
 *
 * The webpack build uses `config.resolve.alias.canvas = false` for the same purpose.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const canvas: any = {};
export default canvas;
export {};
