import { Router } from "express";
import { demoImageSvg } from "../lib/demo";

const router = Router();

// Casella al posto della foto dei costumi degli utenti di prova
router.get("/:file", (req, res) => {
  const first = decodeURIComponent(String(req.params.file)).replace(/\.svg$/, "");
  res.set("Content-Type", "image/svg+xml");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(demoImageSvg(first));
});

export default router;
