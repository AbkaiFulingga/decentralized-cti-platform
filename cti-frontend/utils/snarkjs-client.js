'use client';

// Client-only wrapper around snarkjs.
//
// Rationale:
// - Next.js (dev with RSC / app router) can hit a runtime crash when attempting
//   to dynamically import snarkjs (encode-uri-path `.split`), depending on how
//   webpack resolves chunks.
// - A plain static import in a client-only module is the most robust approach.

import * as snarkjs from 'snarkjs';

export default snarkjs;
