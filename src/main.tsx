import {StrictMode, createRef} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PageErrorBoundary } from './components/PageErrorBoundary';

const rootBoundary = createRef<PageErrorBoundary>();
let fallbackLanguage: 'th' | 'en' = 'th';
try { fallbackLanguage = localStorage.getItem('k7_lang') === 'en' ? 'en' : 'th'; } catch {}

const recoverDashboard = () => {
  window.history.replaceState(null, '', '#dashboard');
  rootBoundary.current?.setState({ failed: false });
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PageErrorBoundary ref={rootBoundary} lang={fallbackLanguage} onHome={recoverDashboard}>
      <App />
    </PageErrorBoundary>
  </StrictMode>,
);
