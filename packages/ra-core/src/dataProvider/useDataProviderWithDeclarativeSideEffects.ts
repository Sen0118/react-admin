import {
    useNotify,
    useRedirect,
    useRefresh,
    useUnselectAll,
} from '../sideEffect';
import useDataProvider, { HookDataProvider } from './useDataProvider';
import { useMemo } from 'react';

/**
 * This version of the useDataProvider hook ensure Query and Mutation components are still usable
 * with side effects declared as objects.
 *
 * This is for backward compatibility only and will be removed in next major version.
 */
const useDataProviderWithDeclarativeSideEffects = (): HookDataProvider => {
    const dataProvider = useDataProvider();
    const notify = useNotify();
    const redirect = useRedirect();
    const refresh = useRefresh();
    const unselectAll = useUnselectAll();

    const dataProviderProxy = useMemo(
        () =>
            new Proxy(dataProvider, {
                get: (target, name) => {
                    return (resource, payload, options) => {
                        const convertToFunctionSideEffect = (
                            resource,
                            sideEffects
                        ) => {
                            if (
                                !sideEffects ||
                                typeof sideEffects === 'function'
                            ) {
                                return sideEffects;
                            }

                            if (Object.keys(sideEffects).length === 0) {
                                return undefined;
                            }

                            const {
                                notification,
                                redirectTo,
                                refresh: needRefresh,
                                unselectAll: needUnselectAll,
                            } = sideEffects;

                            return () => {
                                if (notification) {
                                    notify(
                                        notification.body,
                                        notification.level,
                                        notification.messageArgs
                                    );
                                }

                                if (redirectTo) {
                                    redirect(redirectTo);
                                }

                                if (needRefresh) {
                                    refresh();
                                }

                                if (needUnselectAll) {
                                    unselectAll(resource);
                                }
                            };
                        };

                        const onSuccess = convertToFunctionSideEffect(
                            resource,
                            options.onSuccess
                        );
                        const onFailure = convertToFunctionSideEffect(
                            resource,
                            options.onFailure
                        );
                        return target[name.toString()](resource, payload, {
                            ...options,
                            onSuccess,
                            onFailure,
                        });
                    };
                },
            }),
        [dataProvider, notify, redirect, refresh, unselectAll]
    );

    return dataProviderProxy;
};

export default useDataProviderWithDeclarativeSideEffects;
