import "dotenv/config";
import { createServer } from "node:http";
import { prisma } from "../lib/prisma";
import { getServiceStatuses, getServiceHistory, THEME_C_SERVICES } from "./queries";
import { renderTopPage, renderServicePage, renderNotFound } from "./render";

const PORT = Number(process.env.WEB_PORT ?? 3000);
const BASE_URL = "https://saas-status.jp";

function renderSitemap(): string {
  const urls = ["/", ...THEME_C_SERVICES.map((name) => `/services/${encodeURIComponent(name)}`)];
  const entries = urls.map((path) => `  <url><loc>${BASE_URL}${path}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

function renderRobotsTxt(): string {
  return `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(renderRobotsTxt());
      return;
    }

    if (url.pathname === "/sitemap.xml") {
      res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
      res.end(renderSitemap());
      return;
    }

    if (url.pathname === "/") {
      const statuses = await getServiceStatuses();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderTopPage(statuses));
      return;
    }

    const serviceMatch = url.pathname.match(/^\/services\/([^/]+)\/?$/);
    if (serviceMatch) {
      const companyName = decodeURIComponent(serviceMatch[1]);
      const history = await getServiceHistory(companyName);
      if (!history) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderNotFound());
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderServicePage(companyName, history.incidents, history.isDataPending));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderNotFound());
  } catch (err) {
    console.error("[web] request failed:", err);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
});

server.listen(PORT, () => {
  console.log(`[web] listening on http://localhost:${PORT}`);
});

process.on("SIGTERM", () => {
  server.close(() => prisma.$disconnect());
});
