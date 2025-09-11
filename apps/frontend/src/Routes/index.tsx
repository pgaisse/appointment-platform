
// apps/frontend/src/Routes/index.tsx
import { createAppRouter } from "./routerFactory";
import { ROUTE_LINKS } from "./routes.config";

const router = createAppRouter(ROUTE_LINKS);
export default router;
