// api/proxy/[[...slug]].js
const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  try {
    // Obtener el subpath de forma robusta aunque slug venga vacío
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    let subpath = url.pathname.replace(/^\/api\/proxy\/?/, ""); // ej: "start.html"
    subpath = (subpath || "").toLowerCase();

    // 🟢 /start o /start.html → devolver public/start.html
    if (subpath === "start" || subpath === "start.html") {
      const filePath = path.join(process.cwd(), "public", "start.html");
      const html = fs.readFileSync(filePath, "utf8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    }

    // Alias por si alguna vez cae /apps/modo → /apps/modopay
    if (req.url.includes("/apps/modo/")) {
      const redirectUrl = req.url.replace("/apps/modopay/", "/apps/modo/");
      return res.redirect(302, redirectUrl);
    }

    // Servir cualquier otro archivo que exista en /public (css/js/img)
    if (subpath) {
      const staticPath = path.join(process.cwd(), "public", subpath);
      if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
        const ext = path.extname(staticPath);
        const ct =
          ext === ".js"   ? "application/javascript" :
          ext === ".css"  ? "text/css" :
          ext === ".json" ? "application/json" :
          ext === ".png"  ? "image/png" :
          ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
          "text/plain; charset=utf-8";
        res.setHeader("Content-Type", ct);
        return res.status(200).send(fs.readFileSync(staticPath));
      }
    }

    return res.status(404).json({ error: "NOT_FOUND", subpath });
  } catch (e) {
    console.error("[proxy][error]", e);
    return res.status(500).json({ error: "SERVER_ERROR", message: e.message });
  }
};

