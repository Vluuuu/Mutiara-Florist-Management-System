import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { OrderForm } from '@/components/order-form';
import type { OrderCustomerOption } from '@/types';

type OrdersCreateProps = {
    customers: OrderCustomerOption[];
    selectedCustomerId?: number | null;
};

export default function OrdersCreate({ customers, selectedCustomerId = null }: OrdersCreateProps) {
    return (
        <AppLayout title="Buat Pesanan">
            <Head title="Buat Pesanan" />
            <OrderForm
                mode="create"
                customers={customers}
                selectedCustomerId={selectedCustomerId}
            />
        </AppLayout>
    );
}
