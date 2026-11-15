import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';

const pages = import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>(
    './pages/**/*.tsx',
    { eager: true },
);

void createInertiaApp({
    title: (title) => `${title} — MFMS`,
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
