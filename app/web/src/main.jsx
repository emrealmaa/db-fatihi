import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { UygulamaSaglayici } from './baglam.jsx';
import Uygulama from './Uygulama.jsx';
import './stil.css';

createRoot(document.getElementById('kok')).render(
    <StrictMode>
        <UygulamaSaglayici>
            <Uygulama />
        </UygulamaSaglayici>
    </StrictMode>,
);
