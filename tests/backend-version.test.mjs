import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

for (const [name, status, body, passes] of [
  ["matching release", 200, { data: { info: { version: "1.2.0" } } }, true],
  ["old backend", 200, { data: { info: { version: "1.1.0" } } }, false],
  ["missing version", 200, { data: {} }, false],
  ["failed contract", 503, { error: "unavailable" }, false],
]) {
  test(`backend release check: ${name}`, async () => {
    const server = createServer((_req, res) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const child = spawn(process.execPath, [new URL("../scripts/check-backend-version.mjs", import.meta.url).pathname], {
        env: { ...process.env, CMS_BASE_URL: `http://127.0.0.1:${server.address().port}` },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      const [code] = await once(child, "close");
      assert.equal(code === 0, passes, output);
      if (!passes) assert.match(output, /Expected CMS|HTTP 503/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
