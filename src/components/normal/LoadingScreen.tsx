/** Shared, minimal loading state. `overlay` keeps a completed sweep visible until the shell fades it out. */
export function LoadingScreen({ overlay = false, phase = "visible", motionKey }: { overlay?: boolean; phase?: "visible" | "exiting"; motionKey?: string }) {
  return <div key={motionKey} className={`normal-app loading-screen${overlay ? " loading-overlay" : ""}${phase === "exiting" ? " exiting" : ""}`} role="status" aria-live="polite" aria-label="Loading Normal dashboard">
      <div className="loading-gauge" aria-hidden="true">
        <svg viewBox="0 0 419 225" focusable="false">
          <path d="M12 209.5C5.37258 209.5 -0.0358813 204.123 0.337603 197.506C3.66601 138.538 31.3821 86.0897 73.5604 50.0875C110.15 18.8557 157.623 0 209.5 0C261.377 0 308.85 18.8557 345.44 50.0875C387.618 86.0897 415.334 138.538 418.662 197.506C419.036 204.123 413.627 209.5 407 209.5H209.5H12Z" fill="#74c743" />
          <path d="M407 209.5H209.5L73.5604 50.0875C110.15 18.8557 157.623 0 209.5 0C261.377 0 308.85 18.8557 345.44 50.0875C387.618 86.0897 415.334 138.538 418.662 197.506C419.036 204.123 413.627 209.5 407 209.5Z" fill="#ffd166" />
          <path d="M407 209.5H209.5L345.44 50.0874C387.618 86.0897 415.334 138.538 418.662 197.506C419.036 204.123 413.627 209.5 407 209.5Z" fill="#e45b54" />
          <g className="loading-needle"><path d="M 199 201.85 L 207 105 C 207.8 101.5 211.2 101.5 212 105 L 220 201.85 Z" fill="#151515" /><circle cx="209.5" cy="201.85" r="15" fill="#151515" /><circle cx="209.5" cy="201.85" r="5" fill="#fff" /></g>
        </svg>
      </div>
      <span className="sr-only">Loading</span>
  </div>;
}
