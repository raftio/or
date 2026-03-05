import { Hono } from "hono";
import streaming from "./streaming.js";
import conversations from "./conversations.js";
import memories from "./memories.js";
import images from "./images.js";

export { chatImages } from "./images.js";

const chat = new Hono();

chat.route("/", streaming);
chat.route("/", conversations);
chat.route("/", memories);
chat.route("/", images);

export default chat;
