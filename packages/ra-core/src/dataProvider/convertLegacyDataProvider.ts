import {
    CREATE,
    DELETE,
    DELETE_MANY,
    GET_LIST,
    GET_MANY,
    GET_MANY_REFERENCE,
    GET_ONE,
    UPDATE,
    UPDATE_MANY,
} from '../dataFetchActions';
import { LegacyDataProvider, DataProvider } from '../types';

/**
 * Turn a function-based dataProvider to an object-based one
 *
 * Allows using legacy dataProviders transparently.
 *
 * @param {Function} dataProvider A legacy dataProvider (type, resource, params) => Promise<any>
 *
 * @returns {Object} An dataProvider that react-admin can use
 */
const convertLegacyDataProvider = (
    legacyDataProvider: LegacyDataProvider
): DataProvider => {
    const dataProvider = (...args) => legacyDataProvider.apply(null, args);

    dataProvider.create = (resource, params) =>
        legacyDataProvider(CREATE, resource, params);

    dataProvider.delete = (resource, params) =>
        legacyDataProvider(DELETE, resource, params);

    dataProvider.deleteMany = (resource, params) =>
        legacyDataProvider(DELETE_MANY, resource, params);

    dataProvider.getList = (resource, params) =>
        legacyDataProvider(GET_LIST, resource, params);

    dataProvider.getMany = (resource, params) =>
        legacyDataProvider(GET_MANY, resource, params);

    dataProvider.getManyReference = (resource, params) =>
        legacyDataProvider(GET_MANY_REFERENCE, resource, params);

    dataProvider.getOne = (resource, params) =>
        legacyDataProvider(GET_ONE, resource, params);

    dataProvider.update = (resource, params) =>
        legacyDataProvider(UPDATE, resource, params);

    dataProvider.updateMany = (resource, params) =>
        legacyDataProvider(UPDATE_MANY, resource, params);

    return dataProvider;
};

export default convertLegacyDataProvider;
