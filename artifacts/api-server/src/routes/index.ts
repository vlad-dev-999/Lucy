import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mmfRouter from "./mmf";
import canonicalRouter from "./canonical";
import stage4Router from "./stage4";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mmfRouter);
router.use(stage4Router);
router.use(canonicalRouter);
router.use(stage4Router);

export default router;
