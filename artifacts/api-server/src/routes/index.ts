import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import operationsRouter from "./operations";
import { requireStaff } from "../middlewares/staffAccess";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireStaff);
router.use(operationsRouter);

export default router;
