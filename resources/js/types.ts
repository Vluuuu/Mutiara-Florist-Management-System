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
    customers: string;
    orders: string;
    payments: string;
    expenses: string;
    expenseCategories: string;
    logout: string;
};

export type AppPageProps = PageProps & {
    auth: { user: { name: string } | null };
    nav: DashboardNav;
};
