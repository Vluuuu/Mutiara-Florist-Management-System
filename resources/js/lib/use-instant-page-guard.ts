import { useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';
import { useNavigationState } from '@/lib/navigation-state';

/**
 * Recovers missing page props only when browser history navigation (popstate)
 * lands on an intermediate instant-swap entry without an active visit in flight.
 */
export function useInstantPageGuard(hasRequiredProps: boolean) {
    const { isNavigating, navigationError, lastNavigateType } = useNavigationState();
    const reloadTriggeredRef = useRef(false);

    useEffect(() => {
        if (hasRequiredProps) {
            reloadTriggeredRef.current = false;
            return;
        }

        if (
            !isNavigating &&
            !navigationError &&
            lastNavigateType === 'history' &&
            !reloadTriggeredRef.current
        ) {
            reloadTriggeredRef.current = true;
            router.reload();
        }
    }, [hasRequiredProps, isNavigating, navigationError, lastNavigateType]);
}
