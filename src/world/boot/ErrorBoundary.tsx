import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  onError: (error: unknown, info: ErrorInfo) => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Catches any render error in the world (canvas or DOM UI) and reports it. */
export class WorldErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError(error, info);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
