import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './mobile.css';
import './experience.css';
import './participation.css';
import './typography.css';
import './admin.css';
import './member.css';
import './forms-feedback.css';
import { MobileAppProvider } from './components/InstallApp.tsx';
import { registerServiceWorker } from './utils/registerServiceWorker.ts';
import { SiteAccessGate } from './components/SiteAccessGate.tsx';
import './council-workspace.css';
import './maintenance.css';

createRoot(document.getElementById('root')!).render(<SiteAccessGate><MobileAppProvider><App /></MobileAppProvider></SiteAccessGate>);
registerServiceWorker();
