import { Component, type ReactNode } from 'react';
import { Button, Message } from './controls';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-dvh items-center justify-center bg-ink">
        <Message
          title="Etwas ist schiefgelaufen"
          action={<Button onClick={() => location.reload()}>Seite neu laden</Button>}
        >
          {this.state.error.message}
        </Message>
      </div>
    );
  }
}
