import { test } from "node:test";
import assert from "node:assert/strict";
import { verificationAnchor } from "./verify-state.mjs";
test("read-only verification waits for an exact fixed checkpoint and rejects unavailable agreement", async () => {
  const methods = [],
    block = { number: "0x64", hash: "0xabc" };
  let reads = 0;
  const rpc = async (method, params) => {
    methods.push([method, params]);
    return block;
  };
  const api = async () => ({ active: { id: 4663, block: { number: ++reads === 1 ? 99 : 100 } } });
  assert.deepEqual(await verificationAnchor(rpc, api, 2, async () => {}), block);
  assert.ok(methods.every(([method]) => method === "eth_getBlockByNumber"));
  await assert.rejects(
    () =>
      verificationAnchor(
        rpc,
        async () => ({ active: { id: 4663, block: { number: 99 } } }),
        1,
        async () => {}
      ),
    /no state was changed/
  );
});
