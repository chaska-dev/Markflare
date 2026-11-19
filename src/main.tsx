import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/fonts.css';
import './styles/tokens.css';
import './index.css';
import './styles/scroll.css';
import './styles/media.css';
import './styles/pages.css';
import './styles/editor.css';
import './styles/calendar.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
