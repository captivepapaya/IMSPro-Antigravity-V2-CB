
import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-400 bg-[#0B1120] h-screen font-mono overflow-auto">
          <h1 className="text-2xl font-bold mb-4">System Error</h1>
          <div className="bg-red-900/20 p-4 rounded border border-red-900/50 mb-4">
            <p className="font-bold">{this.state.error?.toString()}</p>
          </div>
          <pre className="text-xs text-gray-400 whitespace-pre-wrap">
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            Reload Application
          </button>
        </div>
      );
    }
    // Fix: Cast 'this' to 'any' to avoid TypeScript error where 'props' is not recognized on the class instance
    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element.");
}
