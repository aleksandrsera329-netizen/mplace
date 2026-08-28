/**
 * Single-port reverse proxy for the Render demo:
 *   /api, /uploads → Nest  :3001
 *   everything else → Next :3002
 */
const http = require("http");

const listenPort = Number(process.env.PORT || 3000);
const apiPort = Number(process.env.API_PORT || 3001);
const webPort = Number(process.env.WEB_PORT || 3002);

function targetFor(urlPath) {
  const path = String(urlPath || "/").split("?")[0];
  if (path === "/api" || path.startsWith("/api/") || path.startsWith("/uploads")) {
    return { hostname: "127.0.0.1", port: apiPort };
  }
  return { hostname: "127.0.0.1", port: webPort };
}

function hopByHop() {
  return new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
  ]);
}

function filterHeaders(src) {
  const skip = hopByHop();
  const out = {};
  for (const [k, v] of Object.entries(src || {})) {
    if (!skip.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

const server = http.createServer((req, res) => {
  const dest = targetFor(req.url || "/");
  const headers = filterHeaders(req.headers);
  headers.host = `127.0.0.1:${dest.port}`;
  const p = http.request(
    {
      hostname: dest.hostname,
      port: dest.port,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, filterHeaders(up.headers));
      up.pipe(res);
    },
  );
  p.on("error", (err) => {
    console.error("[proxy]", dest.port, err.message);
    if (!res.headersSent) res.writeHead(502);
    res.end("Bad gateway");
  });
  req.pipe(p);
});

server.on("upgrade", (req, socket, head) => {
  const dest = targetFor(req.url || "/");
  const headers = { ...req.headers, host: `127.0.0.1:${dest.port}` };
  const p = http.request({
    hostname: dest.hostname,
    port: dest.port,
    path: req.url,
    method: req.method,
    headers,
  });
  p.on("upgrade", (upRes, upSocket, upHead) => {
    let out = "HTTP/1.1 101 Switching Protocols\r\n";
    for (const [k, v] of Object.entries(upRes.headers)) {
      out += `${k}: ${Array.isArray(v) ? v.join(", ") : v}\r\n`;
    }
    out += "\r\n";
    socket.write(out);
    if (upHead && upHead.length) upSocket.write(upHead);
    if (head && head.length) socket.write(head);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });
  p.on("error", () => socket.destroy());
  p.end();
});

server.listen(listenPort, "0.0.0.0", () => {
  console.log(
    `[proxy] :${listenPort} → Next :${webPort} / API :${apiPort}`,
  );
});
