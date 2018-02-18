(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('lodash/filter'), require('lodash/find'), require('lodash/identity'), require('lodash/kebabCase'), require('lodash/orderBy'), require('normalizr'), require('querystring'), require('redux-batched-actions'), require('redux-crud'), require('redux-saga'), require('redux-saga/effects'), require('uuid/v4'), require('whatwg-fetch'), require('lodash/noop'), require('redux-actions')) :
	typeof define === 'function' && define.amd ? define(['lodash/filter', 'lodash/find', 'lodash/identity', 'lodash/kebabCase', 'lodash/orderBy', 'normalizr', 'querystring', 'redux-batched-actions', 'redux-crud', 'redux-saga', 'redux-saga/effects', 'uuid/v4', 'whatwg-fetch', 'lodash/noop', 'redux-actions'], factory) :
	(global.reduxCrudApi = factory(global.filter,global.find,global.identity,global.kebabCase,global.orderBy,global.normalizr,global.qs,global.reduxBatchedActions,global.reduxCrud,global.reduxSaga,global.effects,global.v4,null,global.noop,global.reduxActions));
}(this, (function (filter,find,identity,kebabCase,orderBy,normalizr,qs,reduxBatchedActions,reduxCrud,reduxSaga,effects,v4,whatwgFetch,noop,reduxActions) { 'use strict';

filter = filter && filter.hasOwnProperty('default') ? filter['default'] : filter;
find = find && find.hasOwnProperty('default') ? find['default'] : find;
identity = identity && identity.hasOwnProperty('default') ? identity['default'] : identity;
kebabCase = kebabCase && kebabCase.hasOwnProperty('default') ? kebabCase['default'] : kebabCase;
orderBy = orderBy && orderBy.hasOwnProperty('default') ? orderBy['default'] : orderBy;
reduxCrud = reduxCrud && reduxCrud.hasOwnProperty('default') ? reduxCrud['default'] : reduxCrud;
v4 = v4 && v4.hasOwnProperty('default') ? v4['default'] : v4;
noop = noop && noop.hasOwnProperty('default') ? noop['default'] : noop;

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */



var __assign = Object.assign || function __assign(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
    }
    return t;
};











function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

var metaCreator = function (_, resolve, reject) {
    if (resolve === void 0) { resolve = noop; }
    if (reject === void 0) { reject = noop; }
    return ({ resolve: resolve, reject: reject });
};
var createPromiseAction = function (type, payloadCreator) { return reduxActions.createAction(type, payloadCreator, metaCreator); };

// The names we use for actions don't map to the redux-crud action names, so we do that here.
var mapActionToCRUDAction = {
    create: 'create',
    del: 'delete',
    fetch: 'fetch',
    search: 'fetch',
    update: 'update',
};
// The names we use for actions also must map to the http methods.
var mapActionToHTTPMethod = {
    create: 'post',
    update: 'put',
    del: 'delete',
    fetch: 'get',
    search: 'get',
};
// The default actions available.
var availableActions = ['create', 'update', 'del', 'fetch', 'search'];
/**
 * Creates a saga that handles API operations.
 * Updates optimistically when updating or creating.
 *
 * @param {ICreateAPIActionOptions}
 */
function createAPIAction(_a) {
    var resourceName = _a.resourceName, baseUrl = _a.baseUrl, actionCreators = _a.actionCreators, actionName = _a.actionName, method = _a.method, selectAuthToken = _a.selectAuthToken, selectors = _a.selectors, relations = _a.relations, transformIn = _a.transformIn, transformOut = _a.transformOut;
    /**
     * Generator for the given action.
     * Accepts FSA containing a payload with property 'resource' containing request data.
     * Dispatches start (if applicable) action, makes HTTP calls, dispatches success/error actions with result.
     *
     * @param {FSA} action
     *  {
     * 		payload: {
     * 			resource: any  The resource. This is named grossly right now.
     * 				Really it's whatever params the op needs to work, e.g.
     * 				an ID, search params, a whole model. The ambiguity is rubbish.
     * 			options: {
     * 				endpoint: string  An endpoint to add to the default REST request.
     * 			}
     * 		},
     * 		meta: {
     * 			resolve: Function  The function called when the saga is done
     * 			reject: Function  The function called if the saga throws
     * 		}
     *  }
     */
    return function (_a) {
        var payload = _a.payload, _b = _a.meta, resolve = _b.resolve, reject = _b.reject;
        var resource, options, cid, relationKeys, crudAction, localResource, modelFromState, schema, normalisedResource, _loop_1, _c, _d, _i, i, requestString, requestOptions, contentType, resourceToSend, token, response, data, json, dataIsArray, normalisedData, _loop_2, _e, _f, _g, i, e_1;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    relationKeys = {};
                    crudAction = mapActionToCRUDAction[actionName];
                    if (payload) {
                        (resource = payload.resource, options = payload.options);
                    }
                    localResource = __assign({}, resource);
                    // If we're creating a record, give it the client id if it doesn't have one already
                    if (actionName === 'create') {
                        if (localResource.id) {
                            cid = localResource.id;
                        }
                        else {
                            cid = localResource.id = v4();
                        }
                    }
                    if (!(actionName === 'update')) return [3 /*break*/, 4];
                    return [4 /*yield*/, effects.select(selectors.findById, localResource.id)];
                case 1:
                    modelFromState = _h.sent();
                    if (!!modelFromState) return [3 /*break*/, 3];
                    return [4 /*yield*/, effects.call(reject, "Could not select model with id " + resource.id)];
                case 2:
                    _h.sent();
                    _h.label = 3;
                case 3:
                    localResource = __assign({}, modelFromState, localResource);
                    _h.label = 4;
                case 4:
                    if (!(resource && actionCreators[crudAction + 'Start'])) return [3 /*break*/, 11];
                    if (!(relations && (actionName === 'update' || actionName === 'create'))) return [3 /*break*/, 9];
                    schema = Array.isArray(localResource) ? [relations.schema] : relations.schema;
                    normalisedResource = normalizr.normalize(localResource, schema);
                    _loop_1 = function (i) {
                        var relationData, actions;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    relationData = normalisedResource.entities[i];
                                    if (!relationData) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    // We store relation keys (cids) in order here.
                                    // When we receive relation updates at the end of the action,
                                    // we can replay these keys in order to sync with optimistic updates.
                                    relationKeys[i] = [];
                                    actions = [];
                                    if (relationData.undefined) {
                                        console.warn("One or more of the relations you're trying to " + actionName + " is missing an id.\t\t\t\t\t\t\tBad things are likely to happen as a result.");
                                    }
                                    Object.keys(relationData).forEach(function (id) {
                                        relationKeys[i].push(id);
                                        actions.push(relations.map[i][crudAction + 'Start'](relationData[id]));
                                    });
                                    return [4 /*yield*/, effects.put(reduxBatchedActions.batchActions(actions))];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _c = [];
                    for (_d in relations.map)
                        _c.push(_d);
                    _i = 0;
                    _h.label = 5;
                case 5:
                    if (!(_i < _c.length)) return [3 /*break*/, 8];
                    i = _c[_i];
                    return [5 /*yield**/, _loop_1(i)];
                case 6:
                    _h.sent();
                    _h.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 5];
                case 8: return [3 /*break*/, 11];
                case 9: return [4 /*yield*/, effects.put(actionCreators[crudAction + 'Start'](localResource))];
                case 10:
                    _h.sent();
                    _h.label = 11;
                case 11:
                    requestString = baseUrl + "/" + kebabCase(resourceName);
                    // If we have a specific resource or request type, append it to request URL
                    if ((method === 'get' && actionName !== 'search' && localResource.id) || method === 'delete' || method === 'put') {
                        requestString += "/" + localResource.id;
                    }
                    if (actionName === 'search') {
                        requestString += '/search';
                    }
                    if (options && options.endpoint) {
                        requestString += "/" + options.endpoint;
                    }
                    requestOptions = {
                        method: method.toUpperCase(),
                        headers: new Headers(),
                    };
                    // Add the request body if we're sending data
                    if (method === 'post' || method === 'put') {
                        contentType = options && options.contentType ? options.contentType : 'application/json';
                        resourceToSend = transformOut(__assign({}, localResource));
                        if (actionName === 'create') {
                            delete resourceToSend.id;
                        }
                        if (contentType !== 'multipart/form-data') {
                            requestOptions.headers.append('content-type', contentType);
                        }
                        requestOptions.body = createRequestBody(contentType, resourceToSend);
                    }
                    if (actionName === 'search') {
                        requestString += "?" + qs.stringify(localResource);
                    }
                    if (!selectAuthToken) return [3 /*break*/, 13];
                    return [4 /*yield*/, effects.select(selectAuthToken)];
                case 12:
                    token = _h.sent();
                    requestOptions.headers.append('Authorization', "Bearer " + token);
                    _h.label = 13;
                case 13:
                    _h.trys.push([13, 28, , 34]);
                    return [4 /*yield*/, effects.call(fetch, requestString, requestOptions)];
                case 14:
                    response = _h.sent();
                    if (response.status < 200 || response.status > 299) {
                        throw new Error("HTTP Error: " + response.status);
                    }
                    data = void 0;
                    if (!(actionName === 'del')) return [3 /*break*/, 15];
                    data = localResource;
                    return [3 /*break*/, 17];
                case 15: return [4 /*yield*/, effects.apply(response, response.json)];
                case 16:
                    json = _h.sent();
                    data = json.data ? json.data : json;
                    dataIsArray = Array.isArray(data);
                    if (dataIsArray) {
                        data = data.map(function (item) { return transformIn(item); });
                    }
                    else {
                        data = transformIn(data);
                    }
                    _h.label = 17;
                case 17:
                    if (!(!relations
                        || (crudAction !== 'fetch'
                            && crudAction !== 'update'))) return [3 /*break*/, 22];
                    if (!(actionName === 'create')) return [3 /*break*/, 19];
                    return [4 /*yield*/, effects.put(actionCreators[crudAction + 'Success'](data, cid))];
                case 18:
                    _h.sent();
                    return [3 /*break*/, 21];
                case 19: return [4 /*yield*/, effects.put(actionCreators[crudAction + 'Success'](data))];
                case 20:
                    _h.sent();
                    _h.label = 21;
                case 21: return [3 /*break*/, 26];
                case 22:
                    normalisedData = normalizr.normalize(data, Array.isArray(data) ? [relations.schema] : relations.schema);
                    _loop_2 = function (i) {
                        var relationData, actions;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    relationData = normalisedData.entities[i];
                                    if (!relationData) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    actions = [];
                                    Object.keys(relationData).forEach(function (id, index) {
                                        if (crudAction === 'fetch') {
                                            actions.push(relations.map[i][crudAction + 'Success'](relationData[id]));
                                        }
                                        else {
                                            // We use the previously stored cid to reconcile updates here.
                                            // It's imperative that relations come back in the same order they went out!
                                            actions.push(relations.map[i][crudAction + 'Success'](relationData[id], relationKeys[i] ? relationKeys[i][index] : null));
                                        }
                                    });
                                    return [4 /*yield*/, effects.put(reduxBatchedActions.batchActions(actions))];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _e = [];
                    for (_f in relations.map)
                        _e.push(_f);
                    _g = 0;
                    _h.label = 23;
                case 23:
                    if (!(_g < _e.length)) return [3 /*break*/, 26];
                    i = _e[_g];
                    return [5 /*yield**/, _loop_2(i)];
                case 24:
                    _h.sent();
                    _h.label = 25;
                case 25:
                    _g++;
                    return [3 /*break*/, 23];
                case 26: 
                // Once we're done, call resolve for the Promise caller
                return [4 /*yield*/, effects.call(resolve, data)];
                case 27:
                    // Once we're done, call resolve for the Promise caller
                    _h.sent();
                    return [3 /*break*/, 34];
                case 28:
                    e_1 = _h.sent();
                    if (!(method === 'get')) return [3 /*break*/, 30];
                    return [4 /*yield*/, effects.put(actionCreators[crudAction + 'Error'](e_1.message))];
                case 29:
                    _h.sent();
                    return [3 /*break*/, 32];
                case 30: 
                // Methods that persist data require the resource to revert optimistic updates
                return [4 /*yield*/, effects.put(actionCreators[crudAction + 'Error'](e_1.message, localResource))];
                case 31:
                    // Methods that persist data require the resource to revert optimistic updates
                    _h.sent();
                    _h.label = 32;
                case 32: 
                // Call reject for the Promise caller
                return [4 /*yield*/, effects.call(reject, e_1.message)];
                case 33:
                    // Call reject for the Promise caller
                    _h.sent();
                    return [3 /*break*/, 34];
                case 34: return [2 /*return*/];
            }
        });
    };
}
// Selectors
// ---------
/**
 * Create selectors for the given resource namespace.
 *
 * @param {string} resourceName - The name of the resource as appears in the state
 * @return {any} Object with selector methods
 */
function createSelectors(resourceName) {
    return {
        /**
         * @inheritdocs
         */
        findById: function (state, id) {
            return state[resourceName][id] || null;
        },
        /**
         * @inheritdocs
         */
        findByCid: function (state, cid) {
            return find(state[resourceName], function (item) { return item._cid === cid; });
        },
        /**
         * @inheritdocs
         */
        filter: function (state, predicate) {
            return filter(state[resourceName], predicate);
        },
        orderBy: function (state, predicate, order) {
            return orderBy(state[resourceName], predicate, order);
        },
        /**
         * @inheritdocs
         */
        findAll: function (state) {
            return state[resourceName];
        }
    };
}
/**
 * Creates an object with api methods keyed by name.
 * All of these actions can be dispatched as normal.
 * They will dispatch start (where available), success and error actions
 * in turn, making the http request to the API, the idea being, generic CRUD.
 *
 * @returns {IAPIResource}
 */
function createAPIResource(_a) {
    var resourceName = _a.resourceName, baseUrl = _a.baseUrl, _b = _a.actions, actions = _b === void 0 ? availableActions : _b, selectAuthToken = _a.selectAuthToken, relations = _a.relations, _c = _a.options, options = _c === void 0 ? {
        transformIn: identity,
        transformOut: identity,
    } : _c;
    var actionCreators = reduxCrud.actionCreatorsFor(resourceName);
    var selectors = createSelectors(resourceName);
    var apiResource = {
        workers: {},
        sagas: {},
        actions: actionCreators,
        actionNames: reduxCrud.actionTypesFor(resourceName),
        selectors: selectors,
        reducers: reduxCrud.Map.reducersFor(resourceName)
    };
    // Create a resource for each of our actions
    actions.forEach(function (actionName) {
        if (!mapActionToHTTPMethod[actionName]) {
            throw new Error("Method " + actionName + " not supported for resource " + resourceName);
        }
        // Create the action constant
        apiResource.actionNames[actionName] = resourceName.toUpperCase() + "_" + actionName.toUpperCase();
        // Create the request FSA
        apiResource.actions[actionName] = createPromiseAction(apiResource.actionNames[actionName], identity);
        // If we've got relations, add the root relation to the relations map.
        // This saves us doing it for every persist operation, and lets us iterate
        // over the whole resource with the relations map.
        if (relations) {
            relations.map[resourceName] = actionCreators;
        }
        // Create the worker saga
        apiResource.workers[actionName] = createAPIAction({
            resourceName: resourceName,
            baseUrl: baseUrl,
            actionCreators: actionCreators,
            selectors: selectors,
            actionName: actionName,
            method: mapActionToHTTPMethod[actionName],
            selectAuthToken: selectAuthToken,
            relations: relations,
            transformIn: options.transformIn || identity,
            transformOut: options.transformOut || identity
        });
        // Create the watcher saga
        apiResource.sagas[actionName] = function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, effects.call(reduxSaga.takeLatest, apiResource.actionNames[actionName], apiResource.workers[actionName])];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        };
    });
    return apiResource;
}
/**
 * Creates a request body given a content type.
 *
 * @param {string} contentType e.g. application/json
 * @param {any} resource The resource to send.
 * @return {any} The request body data
 */
function createRequestBody(contentType, resource) {
    switch (contentType) {
        case 'application/json':
            return JSON.stringify(resource);
        case 'multipart/form-data':
            var formData = new FormData();
            for (var name_1 in resource) {
                formData.append(name_1, resource[name_1]);
            }
            return formData;
        default:
            throw new Error("Could not create request body: there is no handler for content-type: " + contentType);
    }
}

return createAPIResource;

})));
//# sourceMappingURL=redux-crud-api.umd.js.map
