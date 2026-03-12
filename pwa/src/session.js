// session.js — Wake Lock + Visibility API + session heartbeat
// Manages screen wake lock and tracks session duration.
//
// The Colab kernel runs on Google's servers and continues execution
// regardless of the mobile client. What this module protects against
// is Android killing Chrome's renderer when the phone's screen dims.
//
// Strategy:
//   1. Wake Lock API  — keeps screen on while launcher is visible
//   2. Visibility API — re-acquires wake lock when user returns
//   3. Heartbeat timer — records last-seen time in localStorage every 4 min

export class SessionManager {
  #wakeLock = null;
  #heartbeatTimer = null;
  #elapsedTimer = null;
  #sessionStart = null;
  #onUpdate = null;

  // 4 minutes — well within Colab's ~90 min idle timeout
  static HEARTBEAT_MS = 4 * 60 * 1000;

  // ── Public API ────────────────────────────────────────────────

  /** @param {function} onUpdate Called on state changes with { isActive, hasWakeLock, elapsed } */
  constructor(onUpdate) {
    this.#onUpdate = onUpdate ?? (() => {});
  }

  /** Request screen wake lock. Returns true if acquired. */
  async requestWakeLock() {
    if (!('wakeLock' in navigator)) {
      console.warn('[Session] Wake Lock API not available (requires HTTPS or localhost)');
      return false;
    }
    try {
      this.#wakeLock = await navigator.wakeLock.request('screen');
      this.#wakeLock.addEventListener('release', () => {
        // Released by OS (screen turned off, tab backgrounded, etc.)
        console.log('[Session] Wake lock released by system');
        this.#wakeLock = null;
        this.#notify();
      });
      console.log('[Session] Wake lock acquired');
      this.#notify();
      return true;
    } catch (err) {
      console.warn('[Session] Wake lock request failed:', err.message);
      this.#wakeLock = null;
      this.#notify();
      return false;
    }
  }

  /** Release the wake lock explicitly (user toggled off). */
  async releaseWakeLock() {
    if (this.#wakeLock) {
      await this.#wakeLock.release();
      this.#wakeLock = null;
      this.#notify();
    }
  }

  /**
   * Set up automatic wake lock re-acquisition on visibility change.
   * Call once at app startup.
   */
  setupVisibilityHandler() {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        // Re-acquire if we had it and it was released by the OS
        if (this.#heartbeatTimer && !this.#wakeLock) {
          await this.requestWakeLock();
        }
        this.#notify();
      }
    });
  }

  /** Start the session heartbeat. */
  startHeartbeat() {
    if (this.#heartbeatTimer) return;
    this.#sessionStart = Date.now();
    this.#doHeartbeat();
    this.#heartbeatTimer = setInterval(
      () => this.#doHeartbeat(),
      SessionManager.HEARTBEAT_MS
    );
    this.#startElapsedTimer();
    this.#notify();
  }

  /** Stop the heartbeat and elapsed timer. */
  stopHeartbeat() {
    if (this.#heartbeatTimer) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
    if (this.#elapsedTimer) {
      clearInterval(this.#elapsedTimer);
      this.#elapsedTimer = null;
    }
    this.#sessionStart = null;
    this.#notify();
  }

  get isActive() { return this.#heartbeatTimer !== null; }
  get hasWakeLock() { return this.#wakeLock !== null; }
  get sessionStart() { return this.#sessionStart; }

  // ── Private ───────────────────────────────────────────────────

  #doHeartbeat() {
    const payload = {
      ts: Date.now(),
      session_start: this.#sessionStart,
      has_wakelock: this.#wakeLock !== null,
    };

    // Persist to localStorage — survives page refreshes, can be read back
    try {
      localStorage.setItem('colab-session-ping', JSON.stringify(payload));
    } catch (_) { /* Storage quota exceeded — ignore */ }

    // Dispatch custom event so UI can react without direct coupling
    document.dispatchEvent(new CustomEvent('colab:heartbeat', { detail: payload }));
    console.log('[Session] Heartbeat', new Date().toLocaleTimeString());
  }

  #startElapsedTimer() {
    const elapsedEl = document.getElementById('session-elapsed');
    if (!elapsedEl) return;

    elapsedEl.removeAttribute('hidden');

    this.#elapsedTimer = setInterval(() => {
      if (!this.#sessionStart) return;
      const sec = Math.floor((Date.now() - this.#sessionStart) / 1000);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      elapsedEl.textContent = h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);
  }

  #notify() {
    this.#onUpdate({
      isActive:    this.isActive,
      hasWakeLock: this.hasWakeLock,
      sessionStart: this.#sessionStart,
    });
  }
}
