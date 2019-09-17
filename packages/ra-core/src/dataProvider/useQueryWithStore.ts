import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import isEqual from 'lodash/isEqual';

import {
    ReduxState,
    Record,
    GetListParams,
    GetManyParams,
    GetManyReferenceParams,
    GetOneParams,
    GetListResult,
    GetManyResult,
    GetManyReferenceResult,
    GetOneResult,
} from '../types';

import { useSafeSetState } from '../util/hooks';
import useDataProvider from './useDataProvider';

export interface Query {
    resource: string;
    payload: object;
}

export interface QueryOptions {
    meta?: any;
    action?: string;
}

export interface QueryResult {
    error?: string;
    loading: boolean;
    loaded: boolean;
}

export interface QueryDataProvider {
    getList: <RecordType = Record, FilterType = object>(
        resource: string,
        params: GetListParams<FilterType>,
        dataSelector: (state: ReduxState) => any,
        totalSelector: (state: ReduxState) => number,
        options?: QueryOptions
    ) => QueryResult & GetListResult<RecordType>;

    getMany: <RecordType = Record>(
        resource: string,
        params: GetManyParams,
        dataSelector: (state: ReduxState) => any,
        options?: QueryOptions
    ) => QueryResult & GetManyResult<RecordType>;

    getManyReference: <RecordType = Record, FilterType = object>(
        resource: string,
        params: GetManyReferenceParams<FilterType>,
        dataSelector: (state: ReduxState) => any,
        totalSelector: (state: ReduxState) => number,
        options?: QueryOptions
    ) => QueryResult & GetManyReferenceResult<RecordType>;

    getOne: <RecordType = Record>(
        resource: string,
        params: GetOneParams,
        dataSelector: (state: ReduxState) => any,
        options?: QueryOptions
    ) => QueryResult & GetOneResult<RecordType>;

    [key: string]: QueryResult & any;
}

/**
 * Lists of records are initialized to a particular object,
 * so detecting if the list is empty requires some work.
 *
 * @see src/reducer/admin/data.ts
 */
const isEmptyList = data =>
    Array.isArray(data)
        ? data.length === 0
        : data &&
          Object.keys(data).length === 0 &&
          data.hasOwnProperty('fetchedAt');

/**
 * Default cache selector. Allows to cache responses by default.
 *
 * By default, custom queries are dispatched as a CUSTOM_QUERY Redux action.
 * The fetch middleware dispatches a CUSTOM_QUERY_SUCCESS when the response comes,
 * and the customQueries reducer stores the result in the store. This selector
 * reads the customQueries store and acts as a response cache.
 */
const defaultDataSelector = query => (state: ReduxState) => {
    const key = JSON.stringify(query);
    return state.admin.customQueries[key]
        ? state.admin.customQueries[key].data
        : undefined;
};

const noopDataSelector = () => [];
const defaultTotalSelector = () => 0;

/**
 * Fetch the data provider through Redux, return the value from the store.
 *
 * The return value updates according to the request state:
 *
 * - start: { loading: true, loaded: false }
 * - success: { data: [data from response], total: [total from response], loading: false, loaded: true }
 * - error: { error: [error from response], loading: false, loaded: true }
 *
 * This hook will return the cached result when called a second time
 * with the same parameters, until the response arrives.
 *
 * @param {Object} query
 * @param {string} query.type The verb passed to th data provider, e.g. 'GET_LIST', 'GET_ONE'
 * @param {string} query.resource A resource name, e.g. 'posts', 'comments'
 * @param {Object} query.payload The payload object, e.g; { post_id: 12 }
 * @param {Object} options
 * @param {string} options.action Redux action type
 * @param {Object} options.meta Redux action metas, including side effects to be executed upon success of failure, e.g. { onSuccess: { refresh: true } }
 * @param {function} dataSelector Redux selector to get the result. Required.
 * @param {function} totalSelector Redux selector to get the total (optional, only for LIST queries)
 *
 * @returns The current request state. Destructure as { data, total, error, loading, loaded }.
 *
 * @example
 *
 * import { useQueryWithStore } from 'react-admin';
 *
 * const UserProfile = ({ record }) => {
 *     const { data, loading, error } = useQueryWithStore(
 *         {
 *             type: 'GET_ONE',
 *             resource: 'users',
 *             payload: { id: record.id }
 *         },
 *         {},
 *         state => state.admin.resources.users.data[record.id]
 *     );
 *     if (loading) { return <Loading />; }
 *     if (error) { return <p>ERROR</p>; }
 *     return <div>User {data.username}</div>;
 * };
 */
const useQueryWithStore = (): QueryDataProvider => {
    const [
        { dataSelector, totalSelector, ...requestedFetch },
        setRequestedFetch,
    ] = useSafeSetState({});
    const data = useSelector(
        requestedFetch.type ? dataSelector : noopDataSelector
    );

    const total = useSelector(totalSelector || defaultTotalSelector);
    const [state, setState] = useSafeSetState({
        data,
        total,
        error: null,
        loading: true,
        loaded: data !== undefined && !isEmptyList(data),
    });
    if (!isEqual(state.data, data) || state.total !== total) {
        setState({
            ...state,
            data,
            total,
            loaded: true,
        });
    }
    const dataProvider = useDataProvider();
    useEffect(() => {
        console.log({ requestedFetch });
        // To mimic the fetching on mount when calling one of the dataProvider like functions
        // returned by the hook, we postpone the fetch call until this state is defined
        if (!requestedFetch.type) {
            return;
        }
        console.log({ requestedFetch });

        dataProvider[requestedFetch.type](
            requestedFetch.resource,
            requestedFetch.params,
            requestedFetch.options
        )
            .then(() => {
                // We don't care about the dataProvider response here, because
                // it was already passed to SUCCESS reducers by the dataProvider
                // hook, and the result is available from the Redux store
                // through the data and total selectors.
                // In addition, if the query is optimistic, the response
                // will be empty, so it should not be used at all.
                setState(prevState => ({
                    ...prevState,
                    loading: false,
                    loaded: true,
                }));
            })
            .catch(error => {
                setState({
                    error,
                    loading: false,
                    loaded: false,
                });
            });
        // deep equality, see https://github.com/facebook/react/issues/14476#issuecomment-471199055
    }, [JSON.stringify(requestedFetch)]); // eslint-disable-line

    // A fake dataProvider to make typescript happy so that it types correctly the proxy
    const proxiedDataProvider: QueryDataProvider = {
        getList: () => null,
        getOne: () => null,
        getMany: () => null,
        getManyReference: () => null,
    };

    const proxy = useMemo(
        () =>
            new Proxy(proxiedDataProvider, {
                get: (_, type) => {
                    return (resource, params, dataSelector, ...args) => {
                        console.log(type, {
                            resource,
                            params,
                            dataSelector,
                            args,
                        });
                        setRequestedFetch({
                            type,
                            resource,
                            params,
                            dataSelector:
                                dataSelector ||
                                defaultDataSelector({
                                    resource: requestedFetch.resource,
                                    params: requestedFetch.params,
                                }),
                            totalSelector:
                                args.length > 0 && typeof args[0] === 'function'
                                    ? args[0]
                                    : defaultTotalSelector,
                            options:
                                args[args.length] &&
                                typeof args[args.length] !== 'function'
                                    ? args[args.length]
                                    : undefined,
                        });
                        return state;
                    };
                },
            }),
        [
            proxiedDataProvider,
            requestedFetch.params,
            requestedFetch.resource,
            setRequestedFetch,
            state,
        ]
    );

    return proxy;
};

export default useQueryWithStore;
