import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mmfRouter from "./mmf";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mmfRouter);

export default router;
