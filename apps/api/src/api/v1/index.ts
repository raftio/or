import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.js";
import context from "./context.js";
import execution from "./execution.js";
import evidence from "./evidence.js";
import outcome from "./outcome.js";
import pr from "./pr.js";
import prIntelligence from "./pr-intelligence.js";
import state from "./state.js";
import traceability from "./traceability.js";
import webhooks from "./webhooks/index.js";
import workflow from "./workflow.js";

const v1 = new Hono().basePath("/v1");
v1.use("*", authMiddleware);

v1.route("/", context);
v1.route("/", execution);
v1.route("/", evidence);
v1.route("/", pr);
v1.route("/", prIntelligence);
v1.route("/", state);
v1.route("/", traceability);
v1.route("/webhooks", webhooks);
v1.route("/", workflow);
v1.route("/", outcome);

export default v1;
