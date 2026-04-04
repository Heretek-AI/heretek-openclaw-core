# Security Remediation Log

**Date:** 2026-04-04  
**Auditor:** Zero-Trust Audit  
**Engineer:** Node.js Runtime Engineer

## Executive Summary

Four critical runtime crashes and security vulnerabilities were identified and remediated in the heretek-openclaw-core repository. All fixes have been applied with inline documentation and `AUDIT-FIX` comments.

---

## A1: EventMesh Null Reference (CRITICAL)

**File:** `modules/a2a-protocol/event-mesh.js:46`

**Issue:** The `connect()` method called `this.subscriber.duplicate()` before `this.subscriber` was initialized, causing a null reference crash at startup.

**Root Cause:** The code attempted to duplicate a subscriber client that was never created. The original logic:
```javascript
this.subscriber = this.subscriber.duplicate(); // this.subscriber is undefined!
```

**Fix Applied:**
1. Create main Redis client with `redis.createClient(...)`
2. Connect the main client: `await this.client.connect()`
3. THEN create subscriber by duplicating: `this.subscriber = this.client.duplicate()`
4. Connect subscriber: `await this.subscriber.connect()`
5. Added try/catch with proper cleanup on failure

**Syntax Verification:** ✅ Passed (`node -c event-mesh.js`)

---

## A2: Gateway Authentication Bypass (CRITICAL)

**File:** `gateway/openclaw-gateway.js`

**Issue:** WebSocket connections were accepted without token validation, allowing unauthorized access to the A2A gateway.

**Root Cause:** 
- `GATEWAY_AUTH_ENABLED` defaulted to `false`
- No token validation in `_handleConnection()`

**Fix Applied:**
1. Changed auth default: enabled in production (`NODE_ENV === 'production'`)
2. Added token validation in `_handleConnection()`:
   - Parse token from query string: `const url = new URL(req.url, ...); const token = url.searchParams.get('token');`
   - If `this.config.auth.enabled`, validate token matches `this.config.auth.token`
   - On failure: `ws.close(4001, 'Unauthorized')` and return early

**Syntax Verification:** ✅ Passed (`node -c openclaw-gateway.js`)

---

## A3: JSON.parse Unhandled Exception (HIGH)

**File:** `gateway/openclaw-gateway.js:389`

**Issue:** Malformed JSON messages caused uncaught exceptions, crashing the gateway process.

**Root Cause:** `JSON.parse()` was inside a try/catch but didn't log the malformed message or return early, allowing partial processing.

**Fix Applied:**
1. Wrapped `JSON.parse` in dedicated try/catch block
2. On parse failure:
   - Log malformed message (truncated to 200 chars)
   - Send JSON error response via `ws.send()`
   - Return early to prevent further processing

**Syntax Verification:** ✅ Passed (`node -c openclaw-gateway.js`)

---

## A4: BFT Consensus Blocking Loops (HIGH)

**File:** `modules/consensus/bft-consensus.js:276-323`

**Issue:** `waitForConsensus()`, `waitForPrePrepare()`, and `waitForNewView()` used busy-wait polling loops that blocked the Node.js event loop.

**Root Cause:** All three methods used:
```javascript
while (Date.now() - startTime < timeout) {
  if (condition) return result;
  await new Promise(resolve => setTimeout(resolve, 100)); // Blocks event loop!
}
```

**Fix Applied:**
1. Made `BFTConsensus` extend `EventEmitter`
2. Added event emissions at state transitions:
   - `handlePrepare()`: emits `'pre-prepare'` when entering commit state
   - `handleCommit()`: emits `'consensus'` when consensus reached
   - `handleNewView()`: emits `'new-view'` when view accepted
3. Replaced all `waitFor*` methods with Promise-based event-driven pattern:
```javascript
async waitForConsensus(request, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const handler = (result) => {
      clearTimeout(timer);
      this.off('consensus', handler);
      resolve({ success: true, request, ...result });
    };
    this.on('consensus', handler);
    const timer = setTimeout(async () => {
      this.off('consensus', handler);
      await this.initViewChange();
      resolve({ success: false, reason: 'timeout' });
    }, timeout);
  });
}
```

**Syntax Verification:** ✅ Passed (`node -c bft-consensus.js`)

---

## Files Modified

| File | Tasks Fixed |
|------|-------------|
| `modules/a2a-protocol/event-mesh.js` | A1 |
| `gateway/openclaw-gateway.js` | A2, A3 |
| `modules/consensus/bft-consensus.js` | A4 |

## Commit Taxonomy Reference

All fixes follow the PRIME_DIRECTIVE taxonomy:
- `fix(core): event-mesh null reference on connect`
- `fix(core): gateway authentication enforcement`
- `fix(core): json parse error handling in gateway`
- `fix(core): bft consensus non-blocking waits`

## Next Steps

1. Run full test suite to verify no regressions
2. Deploy to staging environment for integration testing
3. Monitor logs for any authentication failures or consensus timeouts
4. Consider adding unit tests for new error paths
