import { Head } from '@inertiajs/react';
import { OrderForm } from '@/components/order-form';
import { FormCardSkeleton } from '@/components/ui/page-skeleton';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import type { OrderCustomerOption } from '@/types';

type OrdersCreateProps = {
    customers?: OrderCustomerOption[];
    selectedCustomerId?: number | null;
    todayIso?: string;
};

export default function OrdersCreate({
    customers,
    selectedCustomerId = null,
    todayIso,
}: OrdersCreateProps) {
    useInstantPageGuard(Boolean(customers));

    return (
        <>
            <Head title="Buat Pesanan" />
            {customers ? (
                <OrderForm
                    mode="create"
                    customers={customers}
                    selectedCustomerId={selectedCustomerId}
                    todayIso={todayIso}
                />
            ) : (
                <FormCardSkeleton title="Buat Pesanan" fields={6} />
            )}
        </>
    );
}
