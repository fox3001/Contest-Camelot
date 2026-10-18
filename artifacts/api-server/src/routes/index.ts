import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import costumesRouter from "./costumes";
import votersRouter from "./voters";
import votesRouter from "./votes";
import adminRouter from "./admin";
import entriesRouter from "./entries";
import themeRouter from "./theme";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/sessions", sessionsRouter);
router.use("/costumes", costumesRouter);
router.use("/voters", votersRouter);
router.use("/votes", votesRouter);
router.use("/entries", entriesRouter);
router.use("/theme", themeRouter);
router.use("/admin", adminRouter);

export default router;
