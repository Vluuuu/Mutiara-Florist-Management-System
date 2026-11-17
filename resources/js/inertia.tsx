import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';

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
