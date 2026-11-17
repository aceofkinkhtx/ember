import { Component, type ReactNode } from "react";

/**
 * If one screen fails, show a plain message instead of a blank app. The tab
 * bar stays, and moving to another screen tries again.
 */
export class ScreenBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen">
        <div className="card stack" style={{ gap: 8 }}>
          <div className="card-title">This screen didn't load</div>
          <p className="setting-desc">
            Something went wrong on Ember's side. Your data is safe. Try again,
            or use the tabs below.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }
}
