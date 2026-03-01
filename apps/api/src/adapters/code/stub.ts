import type { CodeProvider } from "./contract.js";

export function createStubCodeProvider(): CodeProvider {
  return {
    async getFile() {
      return null;
    },
    async getTree() {
      return [];
    },
    async *listFiles() {
      /* no-op */
    },
    async testConnection() {
      return { name: "stub" };
    },
  };
}
