import React, { ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safe Logger for Android WebView and Console
function logToNative(type: 'log' | 'warn' | 'error', message: string, detail?: any) {
  const detailStr = detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '';
  const formatted = `[BilingoJS ${type.toUpperCase()}] ${message} ${detailStr}`;
  if (type === 'error') {
    console.error(formatted);
  } else if (type === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }

  try {
    if (typeof window !== 'undefined' && (window as any).AndroidBridge) {
      if (typeof (window as any).AndroidBridge.logMessage === 'function') {
        (window as any).AndroidBridge.logMessage(formatted);
      }
    }
  } catch (_) {}
}

try {
  sessionStorage.removeItem('bilingo_reload_attempted');
} catch (e) {}

window.addEventListener('error', (event) => {
  logToNative('error', 'Uncaught Window Error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack || event.error?.toString() || String(event.error),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logToNative('warn', 'Unhandled Promise Rejection:', {
    reason: event.reason?.stack || event.reason?.toString() || String(event.reason),
  });
});

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

class AppErrorBoundary extends (React.Component as any) {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };
  public declare props: ErrorBoundaryProps;
  public declare setState: (state: Partial<ErrorBoundaryState>) => void;

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    logToNative('error', 'Uncaught React Component Error:', {
      error: error.stack || error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || '初始化渲染時發生未預期的系統錯誤';
      const stackTrace = this.state.error?.stack || '';
      const compStack = this.state.errorInfo?.componentStack || '';

      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0b0f19',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            padding: '24px',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            border: '1px solid #334155',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171', marginBottom: '12px' }}>
              ⚠️ 雙語電台載入遇到異常
            </h2>
            <p style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '16px', lineHeight: '1.5' }}>
              {errorMessage}
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.reload();
                }}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🔄 重新載入畫面
              </button>
              <button
                onClick={() => {
                  this.setState({ showDetails: !this.state.showDetails });
                }}
                style={{
                  backgroundColor: '#334155',
                  color: '#94a3b8',
                  border: '1px solid #475569',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: 'normal',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {this.state.showDetails ? '隱藏技術日誌' : '查看技術日誌'}
              </button>
            </div>

            {this.state.showDetails && (
              <div style={{
                textAlign: 'left',
                backgroundColor: '#0f172a',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#f87171',
                maxHeight: '180px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                border: '1px solid #1e293b'
              }}>
                {stackTrace}
                {compStack && `\n\nComponent Stack:\n${compStack}`}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

let mountRetryCount = 0;
const MAX_MOUNT_RETRIES = 10;

function mountApp() {
  logToNative('log', `mountApp() triggered. Retry attempt: ${mountRetryCount}`);
  let rootElement = document.getElementById('root');

  if (!rootElement) {
    if (mountRetryCount < MAX_MOUNT_RETRIES) {
      mountRetryCount++;
      logToNative('warn', `#root element not found, retrying (${mountRetryCount}/${MAX_MOUNT_RETRIES})...`);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountApp, { once: true });
      } else {
        setTimeout(mountApp, 50);
      }
      return;
    } else {
      logToNative('warn', `#root element missing after max retries. Fallback: creating #root dynamically.`);
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      document.body.appendChild(rootElement);
    }
  }

  try {
    logToNative('log', 'Creating React root and rendering App...');
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </StrictMode>,
    );
    logToNative('log', 'React App successfully mounted and rendered.');

    if (typeof window !== 'undefined' && (window as any).AndroidBridge) {
      if (typeof (window as any).AndroidBridge.onPageReady === 'function') {
        try {
          logToNative('log', 'Notifying AndroidBridge.onPageReady()...');
          (window as any).AndroidBridge.onPageReady();
        } catch (e) {
          logToNative('warn', 'Failed to call AndroidBridge.onPageReady:', e);
        }
      }
    }
  } catch (err) {
    logToNative('error', 'Critical error during mountApp createRoot render:', err);

    if (rootElement) {
      const errDetail = err instanceof Error ? (err.stack || err.message) : String(err);
      rootElement.innerHTML = `
        <div style="background:#0b0f19;color:#f87171;padding:24px;min-height:100vh;font-family:sans-serif;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;">
          <div style="background:#1e293b;padding:24px;border-radius:16px;max-width:480px;width:100%;border:1px solid #334155;">
            <h2 style="font-size:20px;font-weight:bold;margin-bottom:12px;">⚠️ React 掛載失敗</h2>
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin-bottom:16px;word-break:break-all;">
              ${errDetail}
            </p>
            <button onclick="window.location.reload()" style="background:#2563eb;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:bold;cursor:pointer;">
              🔄 重新載入
            </button>
          </div>
        </div>
      `;
    }
  }
}

mountApp();



