import { createWriteStream } from "node:fs";
import { open, rename, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

// Anvil historical snapshots can exceed V8's maximum string length. Decode the
// RPC hex payload and decompress directly to disk, with bounded framing buffers.
export async function* decodeDump(body) {
  let prefix = "",
    suffix = "",
    pending = "",
    started = false,
    ended = false;
  for await (const bytes of body) {
    let chunk = Buffer.from(bytes).toString("ascii");
    if (!started) {
      prefix += chunk;
      const match = /"result"\s*:\s*"0x/.exec(prefix);
      if (!match) {
        if (prefix.length > 65536) throw new Error("Invalid Anvil state response.");
        continue;
      }
      chunk = prefix.slice(match.index + match[0].length);
      prefix = prefix.slice(0, match.index) + '"result":"';
      started = true;
    }
    if (ended) {
      suffix += chunk;
      if (suffix.length > 65536) throw new Error("Invalid Anvil state response.");
      continue;
    }
    const end = chunk.indexOf('"');
    if (end >= 0) {
      suffix = chunk.slice(end);
      chunk = chunk.slice(0, end);
      ended = true;
    }
    const hex = pending + chunk;
    if (!/^[a-fA-F0-9]*$/.test(hex)) throw new Error("Invalid Anvil state encoding.");
    const length = hex.length - (hex.length % 2);
    pending = hex.slice(length);
    if (length) yield Buffer.from(hex.slice(0, length), "hex");
  }
  if (!started || !ended || pending) throw new Error("Incomplete Anvil state response.");
  let envelope;
  try {
    envelope = JSON.parse(prefix + suffix);
  } catch {
    throw new Error("Invalid Anvil state response.");
  }
  if (envelope.error || envelope.result !== "") throw new Error("Anvil state checkpoint failed.");
}

export async function savedStateBlock(file) {
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    const header = Buffer.alloc(Math.min(size, 65536));
    await handle.read(header, 0, header.length, 0);
    const tail = Buffer.alloc(Math.min(size, 128));
    await handle.read(tail, 0, tail.length, size - tail.length);
    if (!tail.toString().trimEnd().endsWith("}")) throw new Error("Incomplete saved Anvil state.");
    const match = /^\s*\{\s*"block"\s*:\s*\{\s*"number"\s*:\s*"(0x[0-9a-fA-F]+)"/.exec(
      header.toString()
    );
    if (!match) throw new Error("Saved Anvil state has no block header.");
    return String(BigInt(match[1]));
  } finally {
    await handle.close();
  }
}

export async function saveDump(url, file) {
  const temporary = `${file}.checkpoint`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "anvil_dumpState", params: [true] }),
      signal: AbortSignal.timeout(600000),
    });
    if (!response.ok) throw new Error("Anvil state checkpoint failed.");
    const decoded = decodeDump(response.body)[Symbol.asyncIterator]();
    const first = await decoded.next();
    if (first.done) throw new Error("Empty Anvil state.");
    // The first network chunk may contain only one byte of the gzip header.
    let initial = first.value;
    while (initial.length < 2) {
      const next = await decoded.next();
      if (next.done) break;
      initial = Buffer.concat([initial, next.value]);
    }
    const input = Readable.from(
      (async function* () {
        yield initial;
        for await (const chunk of { [Symbol.asyncIterator]: () => decoded }) yield chunk;
      })()
    );
    const output = createWriteStream(temporary, { mode: 0o600 });
    if (initial[0] === 31 && initial[1] === 139) await pipeline(input, createGunzip(), output);
    else await pipeline(input, output);
    const block = await savedStateBlock(temporary);
    await rename(temporary, file);
    return block;
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw new Error("Anvil state checkpoint failed; preserve the session for recovery.", {
      cause: error,
    });
  }
}
