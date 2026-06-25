import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import costumesRouter from "./costumes";
import votersRouter from "./voters";
import votesRouter from "./votes";
import adminRouter from "./admin";
import resetRouter from "./reset";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/sessions", sessionsRouter);
router.use("/costumes", costumesRouter);
router.use("/voters", votersRouter);
router.use("/votes", votesRouter);
router.use("/admin", adminRouter);
router.use("/reset", resetRouter);

export default router;
