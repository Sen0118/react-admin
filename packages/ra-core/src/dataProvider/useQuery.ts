import { useEffect } from 'react';

import { useSafeSetState } from '../util/hooks';
import useDataProvider from './useDataProvider';
import useDataProviderWithDeclarativeSideEffects from './useDataProviderWithDeclarativeSideEffects';
import {
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

export interface Query {
    resource: string;
    payload: object;
}

export interface QueryOptions {
    meta?: any;
    action?: string;
    undoable?: false;
    withDeclarativeSideEffectsSupport?: boolean;
}

interface QueryResult {
    error?: string;
    loading: boolean;
    loaded: boolean;
}

interface QueryDataProvider {
    getList: <RecordType = Record, FilterType = any>(
        resource: string,
        params: GetListParams<FilterType>
    ) => QueryResult & GetListResult<RecordType>;

    getMany: <RecordType = Record>(
        resource: string,
        params: GetManyParams
    ) => QueryResult & GetManyResult<RecordType>;

    getManyReference: <RecordType = Record, FilterType = any>(
        resource: string,
        params: GetManyReferenceParams<FilterType>
    ) => QueryResult & GetManyReferenceResult<RecordType>;

    getOne: <RecordType = Record>(
        resource: string,
        params: GetOneParams
    ) => QueryResult & GetOneResult<RecordType>;

    [key: string]: QueryResult & any;
}

/**
 * Fetch the data provider through Redux
 *
 * The return value updates according to the request state:
 *
 * - start: { loading: true, loaded: false }
 * - success: { data: [data from response], total: [total from response], loading: false, loaded: true }
 * - error: { error: [error from response], loading: false, loaded: true }
 *
 * @param {Object} query
 * @param {string} query.resource A resource name, e.g. 'posts', 'comments'
 * @param {Object} query.payload The payload object, e.g; { post_id: 12 }
 * @param {Object} options
 * @param {string} options.action Redux action type
 * @param {Object} options.meta Redux action metas, including side effects to be executed upon success of failure, e.g. { onSuccess: { refresh: true } }
 *
 * @returns An object with the dataProvider query functions (getList, getMany, getManyReference, getOne). Each of them returns the current request state. Destructure as { data, total, error, loading, loaded }.
 *
 * @example
 *
 * import { useQuery } from 'react-admin';
 *
 * const UserProfile = ({ record }) => {
 *     const { data, loading, error } = useQuery({
 *         type: 'GET_ONE',
 *         resource: 'users',
 *         payload: { id: record.id }
 *     });
 *     if (loading) { return <Loading />; }
 *     if (error) { return <p>ERROR</p>; }
 *     return <div>User {data.username}</div>;
 * };
 *
 * @example
 *
 * import { useQuery } from 'react-admin';
 *
 * const payload = {
 *    pagination: { page: 1, perPage: 10 },
 *    sort: { field: 'username', order: 'ASC' },
 * };
 * const UserList = () => {
 *     const { data, total, loading, error } = useQuery({
 *         type: 'GET_LIST',
 *         resource: 'users',
 *         payload
 *     });
 *     if (loading) { return <Loading />; }
 *     if (error) { return <p>ERROR</p>; }
 *     return (
 *         <div>
 *             <p>Total users: {total}</p>
 *             <ul>
 *                 {data.map(user => <li key={user.username}>{user.username}</li>)}
 *             </ul>
 *         </div>
 *     );
 * };
 */
const useQuery = (
    query: Query,
    options: QueryOptions = {}
): QueryDataProvider => {
    const { resource, payload } = query;
    const [requestedFetchType, setRequestedFetchType] = useSafeSetState();
    const [state, setState] = useSafeSetState({
        data: undefined,
        error: null,
        total: null,
        loading: true,
        loaded: false,
    });
    const dataProvider = useDataProvider();
    const dataProviderWithDeclarativeSideEffects = useDataProviderWithDeclarativeSideEffects();

    useEffect(() => {
        // To mimic the fetching on mount when calling one of the dataProvider like functions
        // returned by the hook, we postpone the fetch call until this state is defined
        if (!requestedFetchType) {
            return;
        }
        const dataProviderWithSideEffects = options.withDeclarativeSideEffectsSupport
            ? dataProviderWithDeclarativeSideEffects
            : dataProvider;

        dataProviderWithSideEffects[requestedFetchType](
            resource,
            payload,
            options
        )
            .then(({ data, total }) => {
                setState({
                    data,
                    total,
                    loading: false,
                    loaded: true,
                });
            })
            .catch(error => {
                setState({
                    error,
                    loading: false,
                    loaded: false,
                });
            });
        // deep equality, see https://github.com/facebook/react/issues/14476#issuecomment-471199055
    }, [JSON.stringify({ query, options }), dataProvider, requestedFetchType]); // eslint-disable-line react-hooks/exhaustive-deps

    // A fake dataProvider to make typescript happy so that it types correctly the proxy
    const proxiedDataProvider: QueryDataProvider = {
        getList: () => null,
        getOne: () => null,
        getMany: () => null,
        getManyReference: () => null,
    };

    const proxy = new Proxy(proxiedDataProvider, {
        get: (_, name) => {
            setRequestedFetchType(name);
            return state;
        },
    });

    return proxy;
};

export default useQuery;
