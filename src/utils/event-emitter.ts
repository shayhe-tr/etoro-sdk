type EventMap = { [key: string]: (...args: any[]) => void };

export class TypedEventEmitter<Events extends EventMap = EventMap> {
  private listeners = new Map<keyof Events, Set<Function>>();

  on<K extends keyof Events>(event: K, listener: Events[K]): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  once<K extends keyof Events>(event: K, listener: Events[K]): this {
    const wrapper = ((...args: any[]) => {
      this.off(event, wrapper as Events[K]);
      (listener as Function)(...args);
    }) as Events[K];
    return this.on(event, wrapper);
  }

  off<K extends keyof Events>(event: K, listener: Events[K]): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  protected emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const fn of set) {
      fn(...args);
    }
    return true;
  }

  removeAllListeners(event?: keyof Events): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}
