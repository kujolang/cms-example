type Attempt = { count: number; resetAt: number };

export class BoundedRateLimit {
  readonly #attempts = new Map<string, Attempt>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    readonly maxKeys = 2_048,
  ) {}

  consume(key: string, now = Date.now()) {
    const current = this.#attempts.get(key);
    if (current && current.resetAt > now && current.count >= this.limit) return false;
    if (!current || current.resetAt <= now) {
      this.#makeRoom(now);
      this.#attempts.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      current.count += 1;
      this.#attempts.delete(key);
      this.#attempts.set(key, current);
    }
    return true;
  }

  clear(key: string) {
    this.#attempts.delete(key);
  }

  get size() {
    return this.#attempts.size;
  }

  #makeRoom(now: number) {
    for (const [key, attempt] of this.#attempts) {
      if (attempt.resetAt <= now) this.#attempts.delete(key);
    }
    while (this.#attempts.size >= this.maxKeys) {
      const oldest = this.#attempts.keys().next().value;
      if (oldest === undefined) break;
      this.#attempts.delete(oldest);
    }
  }
}
