import type { PageProps } from '@inertiajs/core';

export type DashboardQueueItem = {
    item_id: number;
    order_id: number;
    order_number: string;
    customer_name: string;
    flower_type: string;
    recipient: string;
    delivery_location: string;
    delivery_date: string;
    delivery_date_raw: string;
    quantity: number;
    fulfillment_status: FulfillmentStatus;
    next_status: FulfillmentStatus | null;
    urgency: 'overdue' | 'today' | 'upcoming';
};

export type DashboardQueueSummary = {
    total_count: number;
    overdue_count: number;
    today_count: number;
};

export type DashboardReceivableItem = {
    id: number;
    order_number: string;
    order_date: string;
    customer_name: string;
    total_amount: number;
    paid_amount: number;
    outstanding: number;
    payment_status: PaymentStatus;
};

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
    uiDashboard?: string;
    legacyDashboard: string;
    uiCustomers?: string;
    customers: string;
    uiOrders?: string;
    uiOrdersCreate?: string;
    orders: string;
    uiPayments?: string;
    payments: string;
    uiExpenses?: string;
    expenses: string;
    uiExpenseCategories?: string;
    expenseCategories: string;
    uiReports?: string;
    uiReportsExport?: string;
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
    csrf_token?: string;
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

export type OrderStatus = 'NEW' | 'PROCESSING' | 'READY' | 'COMPLETED';
export type FulfillmentStatus = 'NEW' | 'PROCESSING' | 'READY' | 'DELIVERED';
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS' | 'OTHER';
export type PaymentRecordStatus = 'POSTED' | 'VOIDED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export type OrderCustomerOption = {
    id: number;
    name: string;
    phone: string | null;
};

export type OrderFormItem = {
    _key: number;
    id?: number | null;
    flower_type: string;
    recipient: string;
    sender_name: string;
    delivery_date: string;
    delivery_location: string;
    quantity: number;
    unit_price: number | null;
    shipping_mode: 'INCLUDED' | 'SEPARATE';
    shipping_fee: number | null;
    fulfillment_status?: FulfillmentStatus;
    _initialStatus?: FulfillmentStatus;
    notes: string;
};

export type OrderEditData = {
    id: number;
    order_number: string;
    customer_id: number;
    order_date: string;
    notes: string;
    status: OrderStatus;
    total_amount: number;
    received: number;
    items: Array<{
        id: number;
        flower_type: string;
        recipient: string;
        sender_name: string;
        delivery_date: string;
        delivery_location: string;
        quantity: number;
        unit_price: number;
        shipping_mode: 'INCLUDED' | 'SEPARATE';
        shipping_fee: number;
        fulfillment_status: FulfillmentStatus;
        notes: string;
    }>;
};

export type ReceivableOrder = {
    id: number;
    order_number: string;
    order_date: string;
    total_amount: number;
    paid_amount: number;
    outstanding: number;
    status: OrderStatus;
    customer_name: string;
};

export type PaymentHistoryItem = {
    id: number;
    order_id: number;
    order_number: string;
    customer_name: string;
    payment_date: string;
    amount: number;
    method: PaymentMethod;
    method_label: string;
    reference: string | null;
    status: PaymentRecordStatus;
    void_reason: string | null;
    voided_at: string | null;
    recorded_by: string;
};

export type OrderListItem = {
    id: number;
    order_number: string;
    order_date: string;
    order_date_raw?: string;
    earliest_delivery_date?: string | null;
    earliest_delivery_date_raw?: string | null;
    first_flower?: string | null;
    customer: {
        id: number;
        name: string;
    };
    status: OrderStatus;
    total_amount: number;
    paid_amount: number;
    payment_status: PaymentStatus;
    payment_status_label: string;
    items_count: number;
};

export type CustomerOrderHistoryItem = {
    id: number;
    order_number: string;
    order_date: string | null;
    status: OrderStatus;
    total_amount: number;
    paid_amount: number;
    outstanding: number;
    payment_status: PaymentStatus;
    items_count: number;
    first_flower: string | null;
    earliest_delivery_date: string | null;
};

export type OrderItemDetail = {
    id: number;
    item_number: number;
    flower_type: string;
    recipient: string;
    sender_name: string;
    delivery_date: string;
    delivery_date_raw?: string;
    delivery_location: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    shipping_mode: 'INCLUDED' | 'SEPARATE';
    shipping_fee: number;
    effective_shipping_fee: number;
    fulfillment_status: FulfillmentStatus;
    notes: string | null;
};

export type OrderPaymentDetail = {
    id: number;
    amount: number;
    payment_date: string;
    payment_date_raw?: string;
    method: PaymentMethod;
    method_label: string;
    status: PaymentRecordStatus;
    reference: string | null;
    notes: string | null;
    recorded_by: string;
    void_reason: string | null;
    voided_at: string | null;
};

export type OrderDetail = {
    id: number;
    order_number: string;
    order_date: string;
    order_date_raw?: string;
    status: OrderStatus;
    notes: string | null;
    total_amount: number;
    received: number;
    outstanding: number;
    flower_total: number;
    shipping_total: number;
    payment_status: PaymentStatus;
    payment_status_label: string;
    customer: {
        id: number;
        name: string;
        phone: string | null;
    };
    items: OrderItemDetail[];
    payments: OrderPaymentDetail[];
};

export type ExpenseCategoryItem = {
    id: number;
    name: string;
    is_active: boolean;
    expenses_count?: number;
};

export type ExpenseItem = {
    id: number;
    expense_category_id: number;
    recorded_by: number;
    expense_date: string;
    amount: number;
    description: string;
    idempotency_key: string;
    status: 'POSTED' | 'VOIDED';
    void_reason: string | null;
    voided_at: string | null;
    category?: {
        id: number;
        name: string;
    };
    recorded_by_user?: {
        id: number;
        name: string;
    };
};

export type ExpenseFilters = {
    q: string;
    category_id: number | null;
    status: 'POSTED' | 'VOIDED' | null;
    from: string | null;
    to: string | null;
};

export type ReportPreset = 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom';

export type ReportPeriod = {
    preset: ReportPreset;
    from: string;
    to: string;
    label: string;
};

export type ReportSummary = {
    orders_count: number;
    total_billed: number;
    flower_total: number;
    shipping_total: number;
    cash_in: number;
    cash_out: number;
    cash_diff: number;
    current_outstanding: number;
    open_receivables_count: number;
};

export type FulfillmentBreakdown = {
    NEW: number;
    PROCESSING: number;
    READY: number;
    COMPLETED: number;
};

export type PaymentBreakdown = {
    UNPAID: number;
    PARTIAL: number;
    PAID: number;
};

export type DailyTrendItem = {
    date: string;
    formatted_date: string;
    orders_count: number;
    billed: number;
    cash_in: number;
    cash_out: number;
};

export type ReportNotes = {
    cash_diff_label: string;
    cash_diff_disclaimer: string;
    outstanding_disclaimer: string;
};

export type FinancialReportData = {
    period: ReportPeriod;
    summary: ReportSummary;
    fulfillment_breakdown: FulfillmentBreakdown;
    payment_breakdown: PaymentBreakdown;
    daily_trends: DailyTrendItem[];
    notes: ReportNotes;
};

