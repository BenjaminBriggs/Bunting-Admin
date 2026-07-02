# Conformance keys

The keys in `keys/` are fixed, test-only material used to produce deterministic (byte-stable) signature vectors in `signature.json`. `test-signing-key.pem`/`test-signing-key.pub.pem` and `wrong-key.pub.pem` are intentionally committed — including the private key `test-signing-key.pem` — so that regenerating the bundle (`pnpm run generate-vectors`) never changes its bytes. None of this is real key material and none of it should ever be reused outside this conformance suite.
