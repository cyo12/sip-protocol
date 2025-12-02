---
"@sip-protocol/sdk": minor
---

Add browser WASM support for ZK proof generation

- New `BrowserNoirProvider` class for browser-based proof generation using WASM
- Progress callbacks for UI feedback during proof generation
- Browser support detection (`checkBrowserSupport()`)
- New import path: `@sip-protocol/sdk/browser`
- Browser-compatible hex/bytes utilities without Node.js Buffer dependency
