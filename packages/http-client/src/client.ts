/* eslint-disable unicorn/no-null */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  ClientRequest,
  IncomingMessage,
  OutgoingHttpHeaders
} from 'node:http'
import type {Socket} from 'node:net'

import type {
  RequestHandler,
  RequestInfo,
  RequestOptions,
  TypedResponse
} from './interfaces.js'

import http, {Agent, globalAgent} from 'node:http'
import https from 'node:https'

import tunnel from 'tunnel'
import {ProxyAgent} from 'undici'

import {HttpClientResponse} from './client-response.js'
import {getProxyUrl as getProxyUrlInternal} from './proxy.js'

export enum HttpCodes {
  OK = 200,
  MultipleChoices = 300,
  MovedPermanently = 301,
  ResourceMoved = 302,
  SeeOther = 303,
  NotModified = 304,
  UseProxy = 305,
  SwitchProxy = 306,
  TemporaryRedirect = 307,
  PermanentRedirect = 308,
  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  NotAcceptable = 406,
  ProxyAuthenticationRequired = 407,
  RequestTimeout = 408,
  Conflict = 409,
  Gone = 410,
  TooManyRequests = 429,
  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  GatewayTimeout = 504
}

export enum Headers {
  Accept = 'accept',
  ContentType = 'content-type'
}

export enum MediaTypes {
  ApplicationJson = 'application/json'
}

/**
 * Returns the proxy URL, depending upon the supplied url and proxy environment variables.
 * @param serverUrl  The server URL where the request will be sent. For example, https://api.github.com
 */
export function getProxyUrl(serverUrl: string): string {
  const proxyUrl = getProxyUrlInternal(new URL(serverUrl))
  return proxyUrl ? proxyUrl.href : ''
}

const HttpRedirectCodes: Set<HttpCodes> = new Set([
  HttpCodes.MovedPermanently,
  HttpCodes.ResourceMoved,
  HttpCodes.SeeOther,
  HttpCodes.TemporaryRedirect,
  HttpCodes.PermanentRedirect
])
const HttpResponseRetryCodes: Set<HttpCodes> = new Set([
  HttpCodes.BadGateway,
  HttpCodes.ServiceUnavailable,
  HttpCodes.GatewayTimeout
])
const RetryableHttpVerbs: Set<string> = new Set([
  'OPTIONS',
  'GET',
  'DELETE',
  'HEAD'
])
const ExponentialBackoffCeiling = 10
const ExponentialBackoffTimeSlice = 5

export class HttpClientError extends Error {
  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'HttpClientError'
    this.statusCode = statusCode
    Object.setPrototypeOf(this, HttpClientError.prototype)
  }

  statusCode: number
  result?: any
}

export function isHttps(requestUrl: string): boolean {
  const parsedUrl: URL = new URL(requestUrl)
  return parsedUrl.protocol === 'https:'
}

export class HttpClient {
  userAgent: string | undefined
  handlers: RequestHandler[]
  requestOptions: RequestOptions | undefined

  private _ignoreSslError = false
  private _socketTimeout: number | undefined
  private _allowRedirects = true
  private _allowRedirectDowngrade = false
  private _maxRedirects = 50
  private _allowRetries = false
  private _maxRetries = 1
  private _agent: any
  private _proxyAgent: any
  private _proxyAgentDispatcher: any
  private _keepAlive = false
  private _disposed = false

  constructor(
    userAgent?: string,
    handlers?: RequestHandler[],
    requestOptions?: RequestOptions
  ) {
    this.userAgent = userAgent
    this.handlers = handlers || []
    this.requestOptions = requestOptions
    if (requestOptions) {
      if (requestOptions.ignoreSslError != undefined) {
        this._ignoreSslError = requestOptions.ignoreSslError
      }

      this._socketTimeout = requestOptions.socketTimeout

      if (requestOptions.allowRedirects != undefined) {
        this._allowRedirects = requestOptions.allowRedirects
      }

      if (requestOptions.allowRedirectDowngrade != undefined) {
        this._allowRedirectDowngrade = requestOptions.allowRedirectDowngrade
      }

      if (requestOptions.maxRedirects != undefined) {
        this._maxRedirects = Math.max(requestOptions.maxRedirects, 0)
      }

      if (requestOptions.keepAlive != undefined) {
        this._keepAlive = requestOptions.keepAlive
      }

      if (requestOptions.allowRetries != undefined) {
        this._allowRetries = requestOptions.allowRetries
      }

      if (requestOptions.maxRetries != undefined) {
        this._maxRetries = requestOptions.maxRetries
      }
    }
  }

  async options(
    requestUrl: string,
    additionalHeaders?: OutgoingHttpHeaders
  ): Promise<HttpClientResponse> {
    return this.request('OPTIONS', requestUrl, null, additionalHeaders || {})
  }

  async get(
    requestUrl: string,
    additionalHeaders?: OutgoingHttpHeaders
  ): Promise<HttpClientResponse> {
    return this.request('GET', requestUrl, null, additionalHeaders || {})
  }

  async del(
    requestUrl: string,
    additionalHeaders?: OutgoingHttpHeaders
  ): Promise<HttpClientResponse> {
    return this.request('DELETE', requestUrl, null, additionalHeaders || {})
  }

  async post(
    requestUrl: string,
    data: string,
    additionalHeaders?: OutgoingHttpHeaders
  ): Promise<HttpClientResponse> {
    return this.request('POST', requestUrl, data, additionalHeaders || {})
  }

  async patch(
    requestUrl: string,
    data: string,
    additionalHeaders?: OutgoingHttpHeaders
  ): Promise<HttpClientResponse> {
    return this.request('PATCH', requestUrl, data, additionalHeaders || {})
  }

  async put(
    requestUrl: string,
    data: string,
    additionalHeaders?: OutgoingHttpHeaders
  ): Promise<HttpClientResponse> {
    return this.request('PUT', requestUrl, data, additionalHeaders || {})
  }

  async head(
    requestUrl: string,
    additionalHeaders?: OutgoingHttpHeaders
  ): Promise<HttpClientResponse> {
    return this.request('HEAD', requestUrl, null, additionalHeaders || {})
  }

  async sendStream(
    verb: string,
    requestUrl: string,
    stream: NodeJS.ReadableStream,
    additionalHeaders?: OutgoingHttpHeaders
  ): Promise<HttpClientResponse> {
    return this.request(verb, requestUrl, stream, additionalHeaders)
  }

  /**
   * Gets a typed object from an endpoint
   * Be aware that not found returns a null.  Other errors (4xx, 5xx) reject the promise
   */
  async getJson<T>(
    requestUrl: string,
    additionalHeaders: OutgoingHttpHeaders = {}
  ): Promise<TypedResponse<T>> {
    //string | string[] | undefined
    additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(
      additionalHeaders,
      Headers.Accept,
      MediaTypes.ApplicationJson
    )
    const res: HttpClientResponse = await this.get(
      requestUrl,
      additionalHeaders
    )
    return this._processResponse<T>(res, this.requestOptions)
  }

  async postJson<T>(
    requestUrl: string,
    obj: any,
    additionalHeaders: OutgoingHttpHeaders = {}
  ): Promise<TypedResponse<T>> {
    const data: string = JSON.stringify(obj, null, 2)
    additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(
      additionalHeaders,
      Headers.Accept,
      MediaTypes.ApplicationJson
    )
    additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(
      additionalHeaders,
      Headers.ContentType,
      MediaTypes.ApplicationJson
    )
    const res: HttpClientResponse = await this.post(
      requestUrl,
      data,
      additionalHeaders
    )
    return this._processResponse<T>(res, this.requestOptions)
  }

  async putJson<T>(
    requestUrl: string,
    obj: any,
    additionalHeaders: OutgoingHttpHeaders = {}
  ): Promise<TypedResponse<T>> {
    const data: string = JSON.stringify(obj, null, 2)
    additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(
      additionalHeaders,
      Headers.Accept,
      MediaTypes.ApplicationJson
    )
    additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(
      additionalHeaders,
      Headers.ContentType,
      MediaTypes.ApplicationJson
    )
    const res: HttpClientResponse = await this.put(
      requestUrl,
      data,
      additionalHeaders
    )
    return this._processResponse<T>(res, this.requestOptions)
  }

  async patchJson<T>(
    requestUrl: string,
    obj: any,
    additionalHeaders: OutgoingHttpHeaders = {}
  ): Promise<TypedResponse<T>> {
    const data: string = JSON.stringify(obj, null, 2)
    additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(
      additionalHeaders,
      Headers.Accept,
      MediaTypes.ApplicationJson
    )
    additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(
      additionalHeaders,
      Headers.ContentType,
      MediaTypes.ApplicationJson
    )
    const res: HttpClientResponse = await this.patch(
      requestUrl,
      data,
      additionalHeaders
    )
    return this._processResponse<T>(res, this.requestOptions)
  }

  /**
   * Makes a raw http request.
   * All other methods such as get, post, patch, and request ultimately call this.
   * Prefer get, del, post and patch
   */
  async request(
    verb: string,
    requestUrl: string,
    data: string | NodeJS.ReadableStream | null,
    headers?: OutgoingHttpHeaders
  ): Promise<HttpClientResponse> {
    if (this._disposed) {
      throw new Error('Client has already been disposed.')
    }

    const parsedUrl = new URL(requestUrl)
    let info: RequestInfo = this._prepareRequest(verb, parsedUrl, headers)

    // Only perform retries on reads since writes may not be idempotent.
    const maxTries: number =
      this._allowRetries && RetryableHttpVerbs.has(verb)
        ? this._maxRetries + 1
        : 1
    let numTries = 0

    let response: HttpClientResponse | undefined
    do {
      response = await this.requestRaw(info, data)

      // Check if it's an authentication challenge
      if (
        response &&
        response.message &&
        response.message.statusCode === HttpCodes.Unauthorized
      ) {
        let authenticationHandler: RequestHandler | undefined

        for (const handler of this.handlers) {
          if (handler.canHandleAuthentication(response)) {
            authenticationHandler = handler
            break
          }
        }

        return authenticationHandler
          ? authenticationHandler.handleAuthentication(this, info, data)
          : // We have received an unauthorized response but have no handlers to handle it.
            // Let the response return to the caller.
            response
      }

      let redirectsRemaining: number = this._maxRedirects
      while (
        response.message.statusCode &&
        HttpRedirectCodes.has(response.message.statusCode) &&
        this._allowRedirects &&
        redirectsRemaining > 0
      ) {
        const redirectUrl: string | undefined =
          response.message.headers['location']
        if (!redirectUrl) {
          // if there's no location to redirect to, we won't
          break
        }
        const parsedRedirectUrl = new URL(redirectUrl)
        if (
          parsedUrl.protocol === 'https:' &&
          parsedUrl.protocol !== parsedRedirectUrl.protocol &&
          !this._allowRedirectDowngrade
        ) {
          throw new Error(
            'Redirect from HTTPS to HTTP protocol. This downgrade is not allowed for security reasons. If you want to allow this behavior, set the allowRedirectDowngrade option to true.'
          )
        }

        // we need to finish reading the response before reassigning response
        // which will leak the open socket.
        await response.readBody()

        // strip authorization header if redirected to a different hostname
        if (parsedRedirectUrl.hostname !== parsedUrl.hostname) {
          for (const header in headers) {
            // header names are case insensitive
            if (header.toLowerCase() === 'authorization') {
              delete headers[header]
            }
          }
        }

        // let's make the request with the new redirectUrl
        info = this._prepareRequest(verb, parsedRedirectUrl, headers)
        response = await this.requestRaw(info, data)
        redirectsRemaining--
      }

      if (
        !response.message.statusCode ||
        !HttpResponseRetryCodes.has(response.message.statusCode)
      ) {
        // If not a retry code, return immediately instead of retrying
        return response
      }

      numTries += 1

      if (numTries < maxTries) {
        await response.readBody()
        await this._performExponentialBackoff(numTries)
      }
    } while (numTries < maxTries)

    return response
  }

  /**
   * Needs to be called if keepAlive is set to true in request options.
   */
  dispose(): void {
    if (this._agent) {
      this._agent.destroy()
    }

    this._disposed = true
  }

  /**
   * Raw request.
   * @param info
   * @param data
   */
  async requestRaw(
    info: RequestInfo,
    data: string | NodeJS.ReadableStream | null
  ): Promise<HttpClientResponse> {
    return new Promise<HttpClientResponse>((resolve, reject) => {
      function callbackForResult(err?: Error, res?: HttpClientResponse): void {
        if (err) {
          reject(err)
        } else if (res) {
          resolve(res)
        } else {
          // If `err` is not passed, then `res` must be passed.
          reject(new Error('Unknown error'))
        }
      }

      this.requestRawWithCallback(info, data, callbackForResult)
    })
  }

  /**
   * Raw request with callback.
   * @param info
   * @param data
   * @param onResult
   */
  requestRawWithCallback(
    info: RequestInfo,
    data: string | NodeJS.ReadableStream | null,
    onResult: (err?: Error, res?: HttpClientResponse) => void
  ): void {
    if (typeof data === 'string') {
      if (!info.options.headers) {
        info.options.headers = {}
      }
      info.options.headers['Content-Length'] = Buffer.byteLength(data, 'utf8')
    }

    let callbackCalled = false
    function handleResult(err?: Error, res?: HttpClientResponse): void {
      if (!callbackCalled) {
        callbackCalled = true
        onResult(err, res)
      }
    }

    const req: ClientRequest = info.httpModule.request(
      info.options,
      (msg: IncomingMessage) => {
        const res: HttpClientResponse = new HttpClientResponse(msg)
        handleResult(undefined, res)
      }
    )

    let socket: Socket
    req.on('socket', sock => {
      socket = sock
    })

    // If we ever get disconnected, we want the socket to timeout eventually
    req.setTimeout(this._socketTimeout || 3 * 60_000, () => {
      if (socket) {
        socket.end()
      }
      handleResult(new Error(`Request timeout: ${info.options.path}`))
    })

    req.on('error', function (err) {
      // err has statusCode property
      // res should have headers
      handleResult(err)
    })

    if (data && typeof data === 'string') {
      req.write(data, 'utf8')
    }

    if (data && typeof data !== 'string') {
      data.on('close', function () {
        req.end()
      })

      data.pipe(req)
    } else {
      req.end()
    }
  }

  /**
   * Gets an http agent. This function is useful when you need an http agent that handles
   * routing through a proxy server - depending upon the url and proxy environment variables.
   * @param serverUrl  The server URL where the request will be sent. For example, https://api.github.com
   */
  getAgent(serverUrl: string): Agent {
    const parsedUrl = new URL(serverUrl)
    return this._getAgent(parsedUrl)
  }

  getAgentDispatcher(serverUrl: string): ProxyAgent | undefined {
    const parsedUrl = new URL(serverUrl)
    const proxyUrl = getProxyUrlInternal(parsedUrl)
    const useProxy = proxyUrl && proxyUrl.hostname
    if (!useProxy) {
      return
    }

    return this._getProxyAgentDispatcher(parsedUrl, proxyUrl)
  }

  private _prepareRequest(
    method: string,
    requestUrl: URL,
    headers?: OutgoingHttpHeaders
  ): RequestInfo {
    const info: RequestInfo = <RequestInfo>{}

    info.parsedUrl = requestUrl
    const usingSsl: boolean = info.parsedUrl.protocol === 'https:'
    info.httpModule = usingSsl ? https : http
    const defaultPort: number = usingSsl ? 443 : 80

    info.options = <RequestOptions>{}
    info.options.host = info.parsedUrl.hostname
    info.options.port = info.parsedUrl.port
      ? Number.parseInt(info.parsedUrl.port)
      : defaultPort
    info.options.path =
      (info.parsedUrl.pathname || '') + (info.parsedUrl.search || '')
    info.options.method = method
    info.options.headers = this._mergeHeaders(headers)
    if (this.userAgent != undefined) {
      info.options.headers['user-agent'] = this.userAgent
    }

    info.options.agent = this._getAgent(info.parsedUrl)

    // gives handlers an opportunity to participate
    if (this.handlers) {
      for (const handler of this.handlers) {
        handler.prepareRequest(info.options)
      }
    }

    return info
  }

  private _mergeHeaders(headers?: OutgoingHttpHeaders): OutgoingHttpHeaders {
    if (this.requestOptions && this.requestOptions.headers) {
      return Object.assign(
        {},
        lowercaseKeys(this.requestOptions.headers),
        lowercaseKeys(headers || {})
      )
    }

    return lowercaseKeys(headers || {})
  }

  private _getExistingOrDefaultHeader<T extends Headers>(
    additionalHeaders: OutgoingHttpHeaders,
    header: T,
    _default: string
  ): OutgoingHttpHeaders[T] {
    let clientHeader: string | undefined
    if (this.requestOptions && this.requestOptions.headers) {
      clientHeader = lowercaseKeys(this.requestOptions.headers)[header]
    }
    return additionalHeaders[header] || clientHeader || _default
  }

  private _getAgent(parsedUrl: URL): Agent {
    let agent
    const proxyUrl = getProxyUrlInternal(parsedUrl)
    const useProxy = proxyUrl && proxyUrl.hostname

    if (this._keepAlive && useProxy) {
      agent = this._proxyAgent
    }

    if (!useProxy) {
      agent = this._agent
    }

    // if agent is already assigned use that agent.
    if (agent) {
      return agent
    }

    const usingSsl = parsedUrl.protocol === 'https:'
    let maxSockets = 100
    if (this.requestOptions) {
      maxSockets = this.requestOptions.maxSockets || globalAgent.maxSockets
    }

    // This is `useProxy` again, but we need to check `proxyURl` directly for TypeScripts's flow analysis.
    if (proxyUrl && proxyUrl.hostname) {
      const agentOptions = {
        maxSockets,
        keepAlive: this._keepAlive,
        proxy: {
          ...((proxyUrl.username || proxyUrl.password) && {
            proxyAuth: `${proxyUrl.username}:${proxyUrl.password}`
          }),
          host: proxyUrl.hostname,
          port: Number.parseInt(proxyUrl.port)
        }
      }

      let tunnelAgent:
        | typeof tunnel.httpsOverHttps
        | typeof tunnel.httpsOverHttp
        | typeof tunnel.httpOverHttps
        | typeof tunnel.httpOverHttp
      const overHttps = proxyUrl.protocol === 'https:'
      if (usingSsl) {
        tunnelAgent = overHttps ? tunnel.httpsOverHttps : tunnel.httpsOverHttp
      } else {
        tunnelAgent = overHttps ? tunnel.httpOverHttps : tunnel.httpOverHttp
      }

      agent = tunnelAgent(agentOptions)
      this._proxyAgent = agent
    }

    // if tunneling agent isn't assigned create a new agent
    if (!agent) {
      const options = {keepAlive: this._keepAlive, maxSockets}
      agent = usingSsl ? new https.Agent(options) : new Agent(options)
      this._agent = agent
    }

    if (usingSsl && this._ignoreSslError) {
      // we don't want to set NODE_TLS_REJECT_UNAUTHORIZED=0 since that will affect request for entire process
      // RequestOptions doesn't expose a way to modify RequestOptions.agent.options
      // we have to cast it to any and change it directly
      agent.options = Object.assign(agent.options || {}, {
        rejectUnauthorized: false
      })
    }

    return agent
  }

  private _getProxyAgentDispatcher(parsedUrl: URL, proxyUrl: URL): ProxyAgent {
    let proxyAgent: any

    if (this._keepAlive) {
      proxyAgent = this._proxyAgentDispatcher
    }

    // if agent is already assigned use that agent.
    if (proxyAgent) {
      return proxyAgent
    }

    const usingSsl = parsedUrl.protocol === 'https:'
    proxyAgent = new ProxyAgent({
      uri: proxyUrl.href,
      pipelining: this._keepAlive ? 1 : 0,
      ...((proxyUrl.username || proxyUrl.password) && {
        token: `${proxyUrl.username}:${proxyUrl.password}`
      })
    })
    this._proxyAgentDispatcher = proxyAgent

    if (usingSsl && this._ignoreSslError) {
      // we don't want to set NODE_TLS_REJECT_UNAUTHORIZED=0 since that will affect request for entire process
      // RequestOptions doesn't expose a way to modify RequestOptions.agent.options
      // we have to cast it to any and change it directly
      proxyAgent.options = Object.assign(proxyAgent.options.requestTls || {}, {
        rejectUnauthorized: false
      })
    }

    return proxyAgent
  }

  private async _performExponentialBackoff(retryNumber: number): Promise<void> {
    retryNumber = Math.min(ExponentialBackoffCeiling, retryNumber)
    const ms: number = ExponentialBackoffTimeSlice * Math.pow(2, retryNumber)
    return new Promise(resolve => setTimeout(() => resolve(), ms))
  }

  private async _processResponse<T>(
    res: HttpClientResponse,
    options?: RequestOptions
  ): Promise<TypedResponse<T>> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<TypedResponse<T>>(async (resolve, reject) => {
      const statusCode = res.message.statusCode || 0

      const response: TypedResponse<T> = {
        statusCode,
        result: null,
        headers: {}
      }

      // not found leads to null obj returned
      if (statusCode === HttpCodes.NotFound) {
        resolve(response)
      }

      // get the result from the body

      // eslint-disable-next-line unicorn/consistent-function-scoping
      function dateTimeDeserializer(_key: any, value: any): any {
        if (typeof value === 'string') {
          const a = new Date(value)
          if (!Number.isNaN(a.valueOf())) {
            return a
          }
        }

        return value
      }

      let obj: any
      let contents: string | undefined

      try {
        contents = await res.readBody()
        if (contents && contents.length > 0) {
          // eslint-disable-next-line unicorn/prefer-ternary
          if (options && options.deserializeDates) {
            obj = JSON.parse(contents, dateTimeDeserializer)
          } else {
            obj = JSON.parse(contents)
          }

          response.result = obj
        }

        response.headers = res.message.headers
      } catch {
        // Invalid resource (contents not json);  leaving result obj null
      }

      // note that 3xx redirects are handled by the http layer.
      if (statusCode > 299) {
        let msg: string

        // if exception/error in body, attempt to get better error
        if (obj && obj.message) {
          msg = obj.message
        } else if (contents && contents.length > 0) {
          // it may be the case that the exception is in the body message as string
          msg = contents
        } else {
          msg = `Failed request: (${statusCode})`
        }

        const err = new HttpClientError(msg, statusCode)
        err.result = response.result

        reject(err)
      } else {
        resolve(response)
      }
    })
  }
}

const lowercaseKeys = (obj: {[index: string]: any}): any =>
  // eslint-disable-next-line unicorn/no-array-reduce
  Object.keys(obj).reduce((c: any, k) => ((c[k.toLowerCase()] = obj[k]), c), {})
