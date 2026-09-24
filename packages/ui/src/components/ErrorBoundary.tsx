import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** What to draw instead. `reset` clears the error and tries the children again. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Told about every error caught, for logging. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches a render error below it and draws a fallback instead of nothing.
 *
 * React unmounts the whole tree on an uncaught render error, which in Noto
 * meant a blank window — no sidebar, no way back to a document, no hint that
 * the work was safe. A boundary turns that into one screen that failed, inside
 * a window that still works.
 *
 * A class because React still offers no hook for this. Reset it by changing
 * its `key` (the router does, per route) or through the `reset` it hands the
 * fallback.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private readonly reset = () => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);

    return this.props.children;
  }
}
