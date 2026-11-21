import { useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';
import { useNavigationState } from '@/lib/navigation-state';

/**
 * Guards Instant Visit intermediate pages or restored browser history entries
 * that do not yet have page-specific props when no navigation is in flight.
 */
export function useInstantPageGuard(hasRequiredProps: boolean) {
    const { isNavigating, navigationError } = useNavigationState();
    const reloadTriggeredRef = useRef(false);

    useEffect(() => {
        if (hasRequiredProps) {
            reloadTriggeredRef.current = false;
            return;
        }

        if (isNavigating || navigationError || reloadTriggeredRef.current) {
            return;
        }

        const timer = window.setTimeout(() => {
            reloadTriggeredRef.current = true;
            router.reload();
        }, 60);

        return () => {
            window.clearTimeout(timer);
        };
    }, [hasRequiredProps, isNavigating, navigationError]);
}
