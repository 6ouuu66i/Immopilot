import React, { type ErrorInfo, type ReactNode } from 'react';
import { captureReactError } from '../lib/posthog';

interface PostHogErrorBoundaryProps {
  children: ReactNode;
}

interface PostHogErrorBoundaryState {
  hasError: boolean;
}

export class PostHogErrorBoundary extends React.Component<PostHogErrorBoundaryProps, PostHogErrorBoundaryState> {
  state: PostHogErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PostHogErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureReactError(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--color-bg-page, #F6F7F5)',
            color: 'var(--color-text-primary, #101613)',
            fontFamily: 'var(--font-sans, Inter, sans-serif)',
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 460, border: '1px solid var(--color-border-default, #E1E4E1)', background: '#FFFFFF', padding: 24 }}>
            <strong style={{ display: 'block', fontSize: 16, marginBottom: 8 }}>Une erreur est survenue.</strong>
            <span style={{ color: 'var(--color-text-secondary, #5F6862)', fontSize: 13 }}>
              Rechargez la page. L'incident a ete transmis au monitoring si PostHog est configure.
            </span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
