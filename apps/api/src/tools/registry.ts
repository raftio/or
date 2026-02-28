import type { ToolSet } from "ai";
import type { ToolContext, ToolFactory } from "./types.js";

export class ToolRegistry {
  private factories: ToolFactory[] = [];

  register(factory: ToolFactory): this {
    this.factories.push(factory);
    return this;
  }

  build(ctx: ToolContext): ToolSet {
    const tools: ToolSet = {};
    for (const factory of this.factories) {
      Object.assign(tools, factory(ctx));
    }
    return tools;
  }
}
