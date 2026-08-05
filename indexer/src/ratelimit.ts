export class RateGuard {
  private readonly perMin: number
  private readonly now: () => number
  private tokens: number
  private last: number

  constructor(perMin: number, now: () => number = Date.now) {
    if (!Number.isFinite(perMin) || perMin <= 0) {
      throw new RangeError(`RateGuard: perMin must be a positive finite number, got ${perMin}`)
    }
    this.perMin = perMin
    this.now = now
    this.tokens = perMin
    this.last = now()
  }

  take(): boolean {
    const now = this.now()
    const elapsed = Math.max(0, now - this.last)
    this.tokens = Math.min(this.perMin, this.tokens + (elapsed / 60_000) * this.perMin)
    this.last = now
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }
}
