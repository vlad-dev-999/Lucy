import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mmfRouter from "./mmf";
import canonicalRouter from "./canonical";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mmfRouter);
router.use(canonicalRouter);

export default router;
