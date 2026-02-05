/**
 * RateLimiter Durable Object
 * 
 * Tracks message frequency per IP and enforces rate limits.
 */

// Utility to handle errors
async function handleErrors(request: Request, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err: any) {
    return new Response(err.stack, { status: 500 });
  }
}

export class RateLimiter implements DurableObject {
  private nextAllowedTime: number;

  constructor() {
    this.nextAllowedTime = 0;
  }

  async fetch(request: Request): Promise<Response> {
    return handleErrors(request, async () => {
      const now = Date.now() / 1000;

      this.nextAllowedTime = Math.max(now, this.nextAllowedTime);

      if (request.method === "POST") {
        // One action per 5 seconds
        this.nextAllowedTime += 5;
      }

      // 20 second grace period (allows burst of 4-5 messages)
      const cooldown = Math.max(0, this.nextAllowedTime - now - 20);
      return new Response(String(cooldown));
    });
  }
}

/**
 * RateLimiterClient - handles rate limiting on the caller side
 */
export class RateLimiterClientImpl {
  private getLimiterStub: () => DurableObjectStub;
  private reportError: (err: Error) => void;
  private limiter: DurableObjectStub;
  private inCooldown: boolean;

  constructor(
    getLimiterStub: () => DurableObjectStub,
    reportError: (err: Error) => void
  ) {
    this.getLimiterStub = getLimiterStub;
    this.reportError = reportError;
    this.limiter = getLimiterStub();
    this.inCooldown = false;
  }

  checkLimit(): boolean {
    if (this.inCooldown) {
      return false;
    }
    this.inCooldown = true;
    this.callLimiter();
    return true;
  }

  private async callLimiter(): Promise<void> {
    try {
      let response: Response;
      try {
        response = await this.limiter.fetch("https://dummy-url", { method: "POST" });
      } catch {
        // Reconnect on disconnect
        this.limiter = this.getLimiterStub();
        response = await this.limiter.fetch("https://dummy-url", { method: "POST" });
      }

      const cooldown = Number(await response.text());
      await new Promise(resolve => setTimeout(resolve, cooldown * 1000));
      this.inCooldown = false;
    } catch (err: any) {
      this.reportError(err);
    }
  }
}
