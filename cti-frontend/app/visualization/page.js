// Duplicate route shim: keep only one source of truth.
// Next.js warns if both page.js and page.jsx define the same route.
// Prefer `page.jsx` and make this file a thin re-export.
export { default } from './page.jsx';
