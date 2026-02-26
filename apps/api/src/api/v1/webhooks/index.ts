import { Hono } from "hono";
import github from "./github.js";

const webhooks = new Hono();
webhooks.route("/github", github);

export default webhooks;
