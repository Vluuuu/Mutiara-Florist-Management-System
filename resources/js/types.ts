import type { PageProps } from '@inertiajs/core';

export type DashboardStats = {
    orders: number;
    billed: number;
    received: number;
    outstanding: number;
    expenses: number;
    cash_flow: number;
};

export type DashboardNav = {
    dashboard: string;
    legacyDashboard: string;
    uiCustomers?: string;
    customers: string;
    orders: string;
    payments: string;
    expenses: string;
    expenseCategories: string;
    logout: string;
};

export type FlashMessages = {
    success?: string | null;
    error?: string | null;
};

export type AppPageProps = PageProps & {
    auth: { user: { id: number; name: string } | null };
    flash?: FlashMessages;
    nav: DashboardNav;
    errors?: Record<string, string>;
};

export type CustomerItem = {
    id: number;
    name: string;
    phone: string | null;
    notes?: string | null;
    orders_count: number;
    created_at?: string;
};

export type CustomerDetail = {
    id: number;
    name: string;
    phone: string | null;
    notes: string | null;
    orders_count: number;
    created_at?: string;
    created_at_raw?: string;
};

export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

export type PaginatedData<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: PaginationLink[];
};
