import { Router } from "express";
import { getCurrentSession, serializeSession } from "../lib/sessions";

const router = Router();

router.get("/active", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }
    res.json(serializeSession(session));
  } catch (err) {
    req.log.error({ err }, "Failed to get active session");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
