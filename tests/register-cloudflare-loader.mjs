import { register } from "node:module";

// The built Worker now imports Cloudflare's tracing namespace. Its tracing
// integration is optional, so the Node-only render harness supplies no tracing.
register(new URL("./cloudflare-loader.mjs", import.meta.url));
