// /api/start.js  (Vercel Node Serverless - sin Next)
import { readFileSync } from "node:fs";
import { join } from "node:path";

export default function handler(req, res) {
  try {
    // Sirve el HTML que ya tenés en /public/start.html
    const filePath = join(process.cwd(), "public", "start.html");
    const html = readFileSync(filePath, "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (e) {
    console.error("START_HTML_ERROR", e);
    res.status(500).send("START_HTML_NOT_FOUND");
  }
}
