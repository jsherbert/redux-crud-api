import filter from 'lodash/filter'
import find from 'lodash/find'
import identity from 'lodash/identity'
import kebabCase from 'lodash/kebabCase'
import noop from 'lodash/noop'
import orderBy from 'lodash/orderBy'
import { ObjectIterator } from 'lodash'
import { normalize, Schema } from 'normalizr'
import * as qs from 'querystring'
import { batchActions } from 'redux-batched-actions'
import { Dispatch } from 'redux'
import reduxCrud from 'redux-crud'
import v4 from 'uuid/v4'

// The names we use for actions don't map to the redux-crud action names, so we do that here.
export const mapActionToCRUDAction = {
  create: 'create',
  del: 'delete',
  fetch: 'fetch',
  search: 'fetch',
  update: 'update'
}

export type MapActionToCRUDAction = typeof mapActionToCRUDAction

export type ActionTypes = keyof MapActionToCRUDAction
export type CRUDActionTypes = MapActionToCRUDAction[keyof MapActionToCRUDAction]

// The names we use for actions also must map to the http methods.
const mapActionToHTTPMethod = {
  create: 'post',
  update: 'put',
  del: 'delete',
  fetch: 'get',
  search: 'get'
} as { [action: string]: string }

// The default actions available.
const availableActions: ActionTypes[] = ['create', 'update', 'del', 'fetch', 'search']

interface ICreateAPIActionOptions {
  // The name of the resource, in the singular
  resourceName: string
  // The action creators generated by redux-crud
  actionCreators: any
  // The selectors generated by redux-crud
  selectors: any
  // The name of the action to dispatch
  actionName: ActionTypes
  // The HTTP method
  method: string
  // The base url for the API action
  baseUrl: string
  // Will be used to set basic auth headers
  selectAuthToken?: (state: any) => string
  // The relations of the model being used
  relations: any
  // The function that models are passed through when they're received
  transformIn: (model: any) => any
  // The function that models are passed through when they're sent
  transformOut: (model: any) => any
}

export interface IAPIActionOptions {
  // The endpoint for requests.
  endpoint?: string
  // The content-type that should be set in request headers.
  contentType?: string
}

export interface IAPIActionParams {
  resource: any
  options?: IAPIActionOptions
}

export type IAPIActionCreator = (
  params?: IAPIActionParams
) => (dispatch: Dispatch<any>, getState: () => any) => Promise<any>

/**
 * Get the request body for a given API action.
 */
const getRequestBody = ({
  resource,
  transformOut,
  actionName,
  contentType
}: {
  resource: any
  transformOut: (resource: any) => any
  actionName: string
  contentType: string
}) => {
  const resourceToSend = transformOut({ ...resource })
  if (actionName === 'create') {
    delete resourceToSend.id
  }
  return createRequestBody(contentType, resourceToSend)
}

const getContentType = (options?: IAPIActionOptions) => {
  return options && options.contentType ? options.contentType : 'application/json'
}

/**
 * Get the request headers for a given API action. These include the content type
 * and any necessary authorisation tokens.
 *
 * @param {string} method
 * @param {IAPIOptions} options
 * @param selectAuthToken
 */
const getRequestHeaders = (method: string, contentType: string, authToken?: string) => {
  const headers = new Headers()
  if ((method === 'post' || method === 'put') && contentType !== 'multipart/form-data') {
    headers.append('content-type', contentType)
  }

  // Add the authentication code to the header, if we have it
  if (authToken) {
    headers.append('authorization', `Bearer ${authToken}`)
  }
  return headers
}

/**
 * Creates a request body given a content type.
 *
 * @param {string} contentType e.g. application/json
 * @param {any} resource The resource to send.
 * @return {any} The request body data
 */
const createRequestBody = (contentType: string, resource: any) => {
  switch (contentType) {
    case 'application/json':
      return JSON.stringify(resource)
    case 'multipart/form-data':
      const formData = new FormData()
      for (const name in resource) {
        formData.append(name, resource[name])
      }
      return formData
    default:
      throw new Error(
        `Could not create request body: there is no handler for content-type: ${contentType}`
      )
  }
}

/**
 * Get the request options for the API action.
 */
const getRequestOptions = ({
  method,
  contentType,
  authToken,
  resource,
  transformOut,
  actionName
}: {
  resource: any
  transformOut: (resource: any) => any
  actionName: string
  contentType: string
  method: string
  authToken?: string
}) => {
  const requestOptions = {
    method: method.toUpperCase(),
    headers: getRequestHeaders(method, contentType, authToken)
  } as {
    method: string
    headers: Headers
    body?: string | FormData
  }
  if (method === 'post' || method === 'put') {
    requestOptions.body = getRequestBody({ resource, transformOut, actionName, contentType })
  }
  return requestOptions
}

/**
 * Get the relative request string for a given API action.
 *
 * @param {string} method
 * @param {string} actionName
 * @param {any} resource
 * @param {string} resourceName
 * @param {IAPIActionOptions} options
 */
const getRequestString = ({
  method,
  actionName,
  resource,
  resourceName,
  options
}: {
  method: string
  actionName: string
  resource: any
  resourceName: string
  options?: IAPIActionOptions
}): string => {
  let requestString = ''
  if (options && options.endpoint) {
    requestString += `/${options.endpoint}`
  } else {
    requestString = `/${kebabCase(resourceName)}`
  }
  // If we have a specific resource or request type, append it to request URL
  if (
    (method === 'get' && actionName !== 'search' && resource.id) ||
    method === 'delete' ||
    method === 'put'
  ) {
    requestString += `/${resource.id}`
  }
  if (actionName === 'search') {
    requestString += `/search?${qs.stringify(resource)}`
  }
  return requestString
}

/**
 * Get data from the API response.
 */
async function getDataFromAPIResponse({
  response,
  resource,
  actionName,
  transformIn
}: {
  response: Response
  resource: any
  actionName: string
  transformIn: (resource: any) => any
}) {
  if (response.status < 200 || response.status > 299) {
    throw new Error(`HTTP Error: ${response.status}`)
  }
  let data
  if (actionName === 'del') {
    data = resource
  } else {
    // We take the data from the 'data' envelope, if it exists,
    // or from the json directly if it doesn't.
    // It'd be good to let the user provide an envelope.
    const json: { data: any } = await response.json()
    data = json.data ? json.data : json
    // Apply transforms
    const dataIsArray = Array.isArray(data)
    if (dataIsArray) {
      data = data.map((item: any) => transformIn(item))
    } else {
      data = transformIn(data)
    }
  }
  return data
}

/**
 * Creates a saga that handles API operations.
 * Updates optimistically when updating or creating.
 *
 * @param {ICreateAPIActionOptions}
 */
function createAPIAction({
  resourceName,
  baseUrl,
  actionCreators,
  actionName,
  method,
  selectAuthToken,
  selectors,
  relations,
  transformIn,
  transformOut
}: ICreateAPIActionOptions): IAPIActionCreator {
  /**
   * Generator for the given action.
   * Accepts FSA containing a payload with property 'resource' containing request data.
   * Dispatches start (if applicable) action, makes HTTP calls, dispatches success/error actions with result.
   */
  return (payload?: IAPIActionParams) => async (dispatch: Dispatch<any>, getState: () => any) => {
    // We store a client id here for optimistic creation
    let resource
    let options
    let cid
    let authToken
    const state = getState()
    const relationKeys = {} as { [relationId: string]: any[] }
    const crudAction = mapActionToCRUDAction[actionName]
    if (payload) {
      ;({ resource, options } = payload)
    }
    if (selectAuthToken) {
      authToken = selectAuthToken(state)
    }

    let localResource = { ...resource }

    // If we're creating a record, give it the client id if it doesn't have one already
    if (actionName === 'create') {
      cid = localResource.id ? localResource.id : (localResource.id = v4())
    }

    // If we're updating a model, merge it with what's current in the state
    if (actionName === 'update') {
      const modelFromState = selectors.findById(state, localResource.id)
      if (!modelFromState) {
        throw new Error(`Could not select model with id ${resource.id}`)
      }
      localResource = { ...modelFromState, ...localResource }
    }

    // Dispatch our start action, if there is one for the given action
    if (resource && actionCreators[crudAction + 'Start']) {
      if (relations && (actionName === 'update' || actionName === 'create')) {
        const schema = Array.isArray(localResource) ? [relations.schema] : relations.schema
        const normalisedResource = normalize(localResource, schema)
        const actions: any[] = []
        for (const i in relations.map) {
          const relationData = normalisedResource.entities[i]
          if (!relationData) {
            continue
          }
          // We store relation keys (cids) in order here.
          // When we receive relation updates at the end of the action,
          // we can replay these keys in order to sync with optimistic updates.
          relationKeys[i] = []

          if (relationData.undefined) {
            console.warn(`One or more of the relations you\'re trying to ${actionName} is missing an id.\
							Bad things are likely to happen as a result.`)
          }
          Object.keys(relationData).forEach(id => {
            relationKeys[i].push(id)
            actions.push(relations.map[i][crudAction + 'Start'](relationData[id]))
          })
        }
        dispatch(batchActions(actions))
      } else {
        dispatch(actionCreators[crudAction + 'Start'](localResource))
      }
    }

    const contentType = getContentType(options)
    const requestOptions = getRequestOptions({
      resource: localResource,
      actionName,
      method,
      contentType,
      authToken,
      transformOut
    })
    const requestString = getRequestString({
      resource: localResource,
      actionName,
      method,
      resourceName,
      options
    })

    // Make the request and handle the response
    try {
      const response = await fetch(baseUrl + requestString, requestOptions)
      const data = await getDataFromAPIResponse({
        resource: localResource,
        response,
        actionName,
        transformIn
      })
      // If there aren't any relations or we're not running a fetch or update, do a basic persist
      if (!relations || (crudAction !== 'fetch' && crudAction !== 'update')) {
        if (actionName === 'create') {
          dispatch(actionCreators[crudAction + 'Success'](data, cid))
        } else {
          dispatch(actionCreators[crudAction + 'Success'](data))
        }
      } else {
        // If we do have relations, normalise the incoming data, and dispatch persist
        // operations for each model. We check here to see if the data is an array (collection),
        // and adjust the schema accordingly.
        const normalisedData = normalize(
          data,
          Array.isArray(data) ? [relations.schema] : relations.schema
        )
        const actions: any[] = []
        for (const i in relations.map) {
          const relationData = normalisedData.entities[i]
          if (!relationData) {
            continue
          }

          Object.keys(relationData).forEach((id, index) => {
            if (crudAction === 'fetch') {
              actions.push(relations.map[i][crudAction + 'Success'](relationData[id]))
            } else {
              // We use the previously stored cid to reconcile updates here.
              // It's imperative that relations come back in the same order they went out!
              actions.push(
                relations.map[i][crudAction + 'Success'](
                  relationData[id],
                  relationKeys[i] ? relationKeys[i][index] : null
                )
              )
            }
          })
        }
        if (!actions.length) {
          // If we haven't received any data, add a single success event.
          // This will ensure that busy indicators are reset etc., and any
          // consumer code watching for success actions will fire as expected.
          actions.push(actionCreators[crudAction + 'Success']([]))
        }
        dispatch(batchActions(actions))
      }
      // Once we're done, call resolve for the Promise caller
      return data
    } catch (e) {
      if (method === 'get') {
        dispatch(actionCreators[crudAction + 'Error'](e.message))
      } else {
        // Methods that persist data require the resource to revert optimistic updates
        dispatch(actionCreators[crudAction + 'Error'](e.message, localResource))
      }
      throw e
    }
  }
}

// Selectors
// ---------

/**
 * Create selectors for the given resource namespace.
 *
 * @param {string} mountPoint - The name of the resource as appears in the state
 * @return {any} Object with selector methods
 */
function createSelectors<IResource extends IBaseResource>(mountPoint: string) {
  const getLocalState = (state: any): IState<IResource> => state[mountPoint]
  return {
    /**
     * @inheritdocs
     */
    findById(state: any, id: number | string) {
      return getLocalState(state).records[id] || null
    },

    /**
     * @inheritdocs
     */
    findByCid(state: any, cid: number | string) {
      return find(
        getLocalState(state).records,
        (item: { _cid?: number | string }) => item._cid === cid
      )
    },

    /**
     * @inheritdocs
     */
    filter(
      state: any,
      predicate:
        | string
        | [string, any]
        | ObjectIterator<
            {
              [key: string]: IResource
            },
            boolean
          >
    ) {
      return filter(getLocalState(state).records, predicate)
    },

    orderBy(state: any, iteratees: string[] | string, order: string[] | string) {
      return orderBy(getLocalState(state).records, iteratees, order)
    },

    /**
     * @inheritdocs
     */
    findAll(state: any) {
      return getLocalState(state).records
    },

    isResourceBusy(state: any) {
      return getLocalState(state).busy
    },

    isBusy(state: any, id: number | string) {
      const record = getLocalState(state).records[id]
      return record ? !!record.busy : false
    },

    isPendingUpdate(state: any, id: number | string) {
      const record = getLocalState(state).records[id]
      return record ? !!record.pendingUpdate : false
    },

    isPendingCreate(state: any, id: number | string) {
      const record = getLocalState(state).records[id]
      return record ? !!record.pendingCreate : false
    },

    lastFetch(state: any) {
      return getLocalState(state).lastFetch
    }
  }
}

export interface ICreateAPIResourceOptions {
  // The name of the resource, conventionally in the singular
  resourceName: string
  // The base url of the resource
  baseUrl: string
  // The actions to add to the returned object
  actions?: Array<ActionTypes>
  // Will be used to set basic auth headers
  selectAuthToken?: (state: any) => string
  /**
   * The relations options. We provide a Normalizr Schema object
   * 	here to process the incoming data, and a map between any additional entity names and
   * 	their reducer functions. For example:
   * ```js{
   * 	schema: book,
   * 	map: {
   * 		author: author.actions
   * 	}
   * }```
   * would update authors nested in data returned from the Book resource.
   */
  relations?: {
    schema: Schema
    map: {
      [key: string]: any
    }
  }
  options?: {
    // The function that models are passed through when they're received
    transformIn: (model: any) => any
    // The function that models are passed through when they're sent
    transformOut: (model: any) => any
  }
}

export interface IBaseResource {
  id: number | string
  _cid?: number | string
  busy?: boolean
  pendingUpdate?: boolean
  pendingCreate?: boolean
}

export interface IState<IResource extends IBaseResource> {
  records: { [key: string]: IResource }
  lastFetch: number | null
  busy: boolean
}

const initialState = {
  records: {},
  lastFetch: null,
  busy: false
}

/**
 * Create the reduce for the given resource.
 */
export const createReducer = <
  IResource extends IBaseResource,
  IAction extends { type: string; time?: number }
>(
  resourceName: string,
  actionNames: { [actionName: string]: string }
) => {
  const recordReducer = reduxCrud.Map.reducersFor(resourceName)
  return (state: IState<IResource> = initialState, action: IAction): IState<IResource> => {
    const newState = {
      ...state,
      records: recordReducer(state.records, action)
    }
    if (
      action.type === actionNames.fetchStart ||
      action.type === actionNames.createStart ||
      action.type === actionNames.updateStart ||
      action.type === actionNames.deleteStart
    ) {
      newState.busy = true
    }
    if (
      action.type === actionNames.fetchSuccess ||
      action.type === actionNames.createSuccess ||
      action.type === actionNames.updateSuccess ||
      action.type === actionNames.deleteSuccess
    ) {
      // If there are no records that are still busy, mark the resource as unbusy.
      if (!Object.keys(state.records).some(id => state.records[id] && !!state.records[id].busy)) {
        newState.busy = false
      }
      if (action.time) {
        newState.lastFetch = action.time
      }
    }
    return newState
  }
}

/**
 * Create the action creators for the given resource.
 *
 * We augment some of the default 'success' action creators here to include a time property,
 * which lets the reducer store staleness information.
 */
export const createActionCreators = (resourceName: string) => {
  const rawActionCreators = reduxCrud.actionCreatorsFor(resourceName)
  const actionCreators = { ...rawActionCreators }
  actionCreators.fetchSuccess = (records?: {}[] | undefined, data?: any) => {
    return {
      ...rawActionCreators.fetchSuccess(records, data),
      time: Date.now()
    }
  }
  actionCreators.updateSuccess = (records?: {} | undefined, data?: any) => {
    return {
      ...rawActionCreators.updateSuccess(records, data),
      time: Date.now()
    }
  }
  actionCreators.createSuccess = (records?: {} | undefined, data?: any) => {
    return {
      ...rawActionCreators.createSuccess(records, data),
      time: Date.now()
    }
  }
  return actionCreators
}

type TActionMap = ReturnType<typeof reduxCrud.actionCreatorsFor>
type TActions = ReturnType<TActionMap[keyof TActionMap]>

/**
 * Creates an object with api methods keyed by name.
 * All of these actions can be dispatched as normal.
 * They will dispatch start (where available), success and error actions
 * in turn, making the http request to the API, the idea being, generic CRUD.
 *
 * @returns {IAPIResource}
 */
function createAPIResource<IResource extends IBaseResource>({
  resourceName,
  baseUrl,
  actions = availableActions,
  selectAuthToken,
  relations,
  options = {
    transformIn: identity,
    transformOut: identity
  }
}: ICreateAPIResourceOptions) {
  const actionCreators = createActionCreators(resourceName)
  const selectors = createSelectors<IResource>(resourceName)
  const actionNames = reduxCrud.actionTypesFor(resourceName)
  const apiResource = {
    thunks: {} as { [action: string]: IAPIActionCreator },
    actions: actionCreators,
    actionNames: {} as { [actionName: string]: string },
    selectors,
    reducers: createReducer<IResource, TActions>(resourceName, actionNames)
  }

  // Create a resource for each of our actions
  actions.forEach(actionName => {
    if (!mapActionToHTTPMethod[actionName]) {
      throw new Error(`Method ${actionName} not supported for resource ${resourceName}`)
    }

    // If we've got relations, add the root relation to the relations map.
    // This saves us doing it for every persist operation, and lets us iterate
    // over the whole resource with the relations map.
    if (relations) {
      relations.map[resourceName] = actionCreators
    }

    apiResource.actionNames = actionNames

    // Create the worker saga
    apiResource.thunks[actionName] = createAPIAction({
      resourceName,
      baseUrl,
      actionCreators,
      selectors,
      actionName,
      method: mapActionToHTTPMethod[actionName],
      selectAuthToken,
      relations,
      transformIn: options.transformIn || identity,
      transformOut: options.transformOut || identity
    })
  })
  return apiResource
}

export default createAPIResource
