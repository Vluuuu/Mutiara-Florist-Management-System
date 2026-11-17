import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { OrderForm } from '@/components/order-form';
import type { OrderCustomerOption, OrderEditData } from '@/types';

type OrdersEditProps = {
    order: OrderEditData;
    customers: OrderCustomerOption[];
    todayIso?: string;
};

export default function OrdersEdit({ order, customers, todayIso }: OrdersEditProps) {
    return (
        <AppLayout title={`Edit Pesanan ${order.order_number}`}>
            <Head title={`Edit ${order.order_number}`} />
            <OrderForm mode="edit" customers={customers} order={order} todayIso={todayIso} />
        </AppLayout>
    );
}
