import { Hono } from "hono";
import context from "./context.js";
import execution from "./execution.js";
import evidence from "./evidence.js";
import workflow from "./workflow.js";
import outcome from "./outcome.js";

const v1 = new Hono().basePath("/v1");

v1.route("/", context);
v1.route("/", execution);
v1.route("/", evidence);
v1.route("/", workflow);
v1.route("/", outcome);

export default v1;
