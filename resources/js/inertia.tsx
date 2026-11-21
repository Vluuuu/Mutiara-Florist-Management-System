import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';
import AppLayout from '@/layouts/app-layout';
import { initNavigationLifecycle } from '@/lib/navigation-state';

initNavigationLifecycle();

router.on('navigate', (event) => {
    const pageProps = event.detail.page.props as { csrf_token?: string };
    if (pageProps?.csrf_token && typeof document !== 'undefined') {
        const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
        if (meta) {
            meta.setAttribute('content', pageProps.csrf_token);
        }
    }
});

const pages = import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>(
    './pages/**/*.tsx',
    { eager: true },
);

void createInertiaApp({
    title: (title) => `${title} - MFMS`,
    layout: (name) => (name === 'Auth/Login' || name === 'Preview' ? undefined : AppLayout),
    progress: {
        delay: 120,
        color: '#1D3B2A',
        showSpinner: false,
    },
    defaults: {
        prefetch: {
            cacheFor: '10s',
            hoverDelay: 75,
        },
    },
    resolve: (name) => {
        const page = pages[`./pages/${name}.tsx`];

        if (!page) {
            throw new Error(`Halaman Inertia tidak ditemukan: ${name}`);
        }

        return page;
    },
    setup: ({ el, App, props }) => {
        createRoot(el).render(<App {...props} />);
    },
});
