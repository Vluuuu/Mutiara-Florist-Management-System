import { Head } from '@inertiajs/react';
import { OrderForm } from '@/components/order-form';
import { FormCardSkeleton } from '@/components/ui/page-skeleton';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import type { OrderCustomerOption, OrderEditData } from '@/types';

type OrdersEditProps = {
    order?: OrderEditData;
    customers?: OrderCustomerOption[];
    todayIso?: string;
};

export default function OrdersEdit({ order, customers, todayIso }: OrdersEditProps) {
    useInstantPageGuard(Boolean(order && customers));

    return (
        <>
            <Head title={order ? `Edit ${order.order_number}` : 'Edit Pesanan'} />
            {order && customers ? (
                <OrderForm mode="edit" customers={customers} order={order} todayIso={todayIso} />
            ) : (
                <FormCardSkeleton fields={6} />
            )}
        </>
    );
}
