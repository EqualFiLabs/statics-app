import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import { decodeDump, saveDump, savedStateBlock, checkpointLimit } from "./state.mjs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
const state = '{"block":{"number":"0x123"},"best_block_number":291,"historical_states":[]}';
async function* pieces(text, size = 3) {
  for (let i = 0; i < text.length; i += size) yield Buffer.from(text.slice(i, i + size));
}
test("state decoder handles every framing and hex boundary without whole-state strings", async () => {
  const encoded = gzipSync(state);
  for (const size of [1, 3, 16, 4096]) {
    const output = [];
    for await (const chunk of decodeDump(
      pieces(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: `0x${encoded.toString("hex")}` }),
        size
      )
    ))
      output.push(chunk);
    assert.deepEqual(Buffer.concat(output), encoded);
  }
  for (const text of [
    '{"result":"0xabc"}',
    '{"result":"0xzz"}',
    '{"result":"0xab',
    '{"error":{"message":"secret"}}',
  ]) {
    await assert.rejects(async () => {
      for await (const chunk of decodeDump(pieces(text))) void chunk;
    }, /Anvil/);
  }
});
test("atomic streaming checkpoint handles gzip and plain dumps and preserves previous state on failure", async () => {
  await mkdir(".local/tooling-tests", { recursive: true });
  const path = await mkdtemp(".local/tooling-tests/state-");
  const file = resolve(path, "state.json");
  let body;
  const requests = [];
  const server = createServer(async (req, res) => {
    let input = "";
    for await (const chunk of req) input += chunk;
    requests.push(JSON.parse(input));
    res.end(body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    for (const buffer of [gzipSync(state), Buffer.from(state)]) {
      body = JSON.stringify({ jsonrpc: "2.0", result: `0x${buffer.toString("hex")}`, id: 1 });
      assert.equal(await saveDump(`http://127.0.0.1:${server.address().port}`, file), "291");
      assert.equal(await readFile(file, "utf8"), state);
      assert.equal(await savedStateBlock(file), "291");
    }
    body = '{"result":"0x12';
    await assert.rejects(
      () => saveDump(`http://127.0.0.1:${server.address().port}`, file),
      /preserve/
    );
    assert.equal(await readFile(file, "utf8"), state);
    assert.ok(
      requests.every(
        (request) =>
          request.method === "anvil_dumpState" &&
          request.params.length === 1 &&
          request.params[0] === false
      ),
      "No checkpoint may request full historical states."
    );
    await writeFile(file, state.slice(0, -1));
    await assert.rejects(() => savedStateBlock(file), /Incomplete/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("decoded checkpoint bytes are bounded even for compressed responses", async () => {
  await assert.rejects(
    () =>
      pipeline(
        Readable.from([Buffer.from("12345"), Buffer.from("6789")]),
        checkpointLimit(8),
        async function* (source) {
          for await (const chunk of source) yield chunk;
        }
      ),
    /size limit/
  );
});
