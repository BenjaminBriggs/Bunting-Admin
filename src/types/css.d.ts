// TypeScript 6 tightened side-effect import checking and no longer infers a type
// for plain CSS imports (TS2882). Declare the module so `import './globals.css'`
// type-checks. CSS Modules (`*.module.css`) are still typed by next-env.d.ts.
declare module '*.css';
