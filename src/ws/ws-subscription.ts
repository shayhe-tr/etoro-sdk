export class WsSubscriptionTracker {
  private subscriptions = new Set<string>();

  add(topics: string[]): void {
    for (const topic of topics) {
      this.subscriptions.add(topic);
    }
  }

  remove(topics: string[]): void {
    for (const topic of topics) {
      this.subscriptions.delete(topic);
    }
  }

  getAll(): string[] {
    return [...this.subscriptions];
  }

  has(topic: string): boolean {
    return this.subscriptions.has(topic);
  }

  clear(): void {
    this.subscriptions.clear();
  }

  get size(): number {
    return this.subscriptions.size;
  }
}
