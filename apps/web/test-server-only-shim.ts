// Vitest shim for the `server-only` import marker. The real module
// throws at module-eval to prevent server-only code from being bundled
// into client components. Under Vitest we are always in Node, so the
// guard is meaningless — exporting nothing makes the import inert.
export {};
