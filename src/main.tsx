import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { LimiteDeErro } from '@/observabilidade/LimiteDeErro';
import { iniciarTelemetria } from '@/observabilidade/telemetria';
import '@/index.css';

// Antes de montar: um erro no primeiro render também precisa ser registrado.
iniciarTelemetria();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LimiteDeErro>
      <App />
    </LimiteDeErro>
  </StrictMode>,
);
