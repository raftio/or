import { Hono } from "hono";
import context from "./context.js";
import execution from "./execution.js";
import evidence from "./evidence.js";
import workflow from "./workflow.js";
import outcome from "./outcome.js";
import workspaces from "./workspaces.js";
import integrations from "./integrations.js";
import apiTokens from "./api-tokens.js";

const v1 = new Hono().basePath("/v1");

v1.route("/", context);
v1.route("/", execution);
v1.route("/", evidence);
v1.route("/", workflow);
v1.route("/", outcome);
v1.route("/", workspaces);
v1.route("/", integrations);
v1.route("/", apiTokens);

export default v1;
