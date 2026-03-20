import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AppThemeProvider } from './lib/theme';
import { readAppConfig } from './lib/config';
import { StartupFailure } from './components/layout/StartupFailure';

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
