import { EventEmitter } from "node:events";

export interface WorkspaceEvent {
  id: string;
  workspace_id: string;
  type: string;
  title: string;
  detail: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

class WorkspaceEventBus extends EventEmitter {
  private connectionsByWorkspace = new Map<string, Set<string>>();

  emit(eventName: "event", event: WorkspaceEvent): boolean;
  emit(eventName: string | symbol, ...args: unknown[]): boolean {
    return super.emit(eventName, ...args);
  }

  on(eventName: "event", listener: (event: WorkspaceEvent) => void): this;
  on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(eventName, listener);
  }

  off(eventName: "event", listener: (event: WorkspaceEvent) => void): this;
  off(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(eventName, listener);
  }

  trackConnection(workspaceId: string, connectionId: string): void {
    let set = this.connectionsByWorkspace.get(workspaceId);
    if (!set) {
      set = new Set();
      this.connectionsByWorkspace.set(workspaceId, set);
    }
    set.add(connectionId);
  }

  removeConnection(workspaceId: string, connectionId: string): void {
    const set = this.connectionsByWorkspace.get(workspaceId);
    if (set) {
      set.delete(connectionId);
      if (set.size === 0) this.connectionsByWorkspace.delete(workspaceId);
    }
  }

  getConnectionCount(workspaceId?: string): number {
    if (workspaceId) {
      return this.connectionsByWorkspace.get(workspaceId)?.size ?? 0;
    }
    let total = 0;
    for (const set of this.connectionsByWorkspace.values()) total += set.size;
    return total;
  }

  getWorkspaceIds(): string[] {
    return Array.from(this.connectionsByWorkspace.keys());
  }
}

export const eventBus = new WorkspaceEventBus();
eventBus.setMaxListeners(1000);
