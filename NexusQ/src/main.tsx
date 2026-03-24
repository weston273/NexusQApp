import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AppThemeProvider } from './lib/theme';
import { readAppConfig } from './lib/config';
import { StartupFailure } from './components/layout/StartupFailure';
import { registerPushServiceWorker } from './features/notifications/push-runtime';

const root = ReactDOM.createRoot(document.getElementById('root')!);

function render(element: React.ReactNode) {
  root.render(
    <React.StrictMode>
      <AppThemeProvider>{element}</AppThemeProvider>
    </React.StrictMode>
  );
}

async function bootstrap() {
  const config = readAppConfig();
  if (!config.ok) {
    render(
      <StartupFailure
        title="Frontend configuration is incomplete"
        description="NexusQ cannot start until the required browser environment variables are configured."
        details={config.error.issues.map((issue) => `${issue.key}: ${issue.message}`)}
        actionLabel="Reload after restarting app"
        onAction={() => window.location.reload()}
      />
    );
    return;
  }

  const [{ BrowserRouter }, { default: App }] = await Promise.all([
    import('react-router-dom'),
    import('./App'),
  ]);

  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  void registerPushServiceWorker().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown service worker registration failure';
    console.warn('Failed to register push service worker.', message, {
      vapidConfigured: Boolean(config.data.pushVapidPublicKey),
    });
  });
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected startup failure';
  render(
    <StartupFailure
      title="NexusQ could not finish startup"
      description="The application failed before the workspace shell could load."
      details={[message]}
      onAction={() => window.location.reload()}
    />
  );
});
