import type {RequestOptions} from 'node:http'

import type {HttpClientResponse} from './client-response.js'
import type {RequestHandler} from './interfaces.js'

export class BasicCredentialHandler implements RequestHandler {
  username: string
  password: string

  constructor(username: string, password: string) {
    this.username = username
    this.password = password
  }

  prepareRequest(options: RequestOptions): void {
    if (!options.headers) {
      throw Error('The request has no headers')
    }
    options.headers['Authorization'] = `Basic ${Buffer.from(
      `${this.username}:${this.password}`
    ).toString('base64')}`
  }

  // This handler cannot handle 401
  canHandleAuthentication(): boolean {
    return false
  }

  async handleAuthentication(): Promise<HttpClientResponse> {
    throw new Error('not implemented')
  }
}

export class BearerCredentialHandler implements RequestHandler {
  token: string

  constructor(token: string) {
    this.token = token
  }

  // currently implements pre-authorization
  // TODO: support preAuth = false where it hooks on 401
  prepareRequest(options: RequestOptions): void {
    if (!options.headers) {
      throw Error('The request has no headers')
    }
    options.headers['Authorization'] = `Bearer ${this.token}`
  }

  // This handler cannot handle 401
  canHandleAuthentication(): boolean {
    return false
  }

  async handleAuthentication(): Promise<HttpClientResponse> {
    throw new Error('not implemented')
  }
}

export class PersonalAccessTokenCredentialHandler implements RequestHandler {
  token: string

  constructor(token: string) {
    this.token = token
  }

  // currently implements pre-authorization
  // TODO: support preAuth = false where it hooks on 401
  prepareRequest(options: RequestOptions): void {
    if (!options.headers) {
      throw Error('The request has no headers')
    }
    options.headers['Authorization'] = `Basic ${Buffer.from(
      `PAT:${this.token}`
    ).toString('base64')}`
  }

  // This handler cannot handle 401
  canHandleAuthentication(): boolean {
    return false
  }

  async handleAuthentication(): Promise<HttpClientResponse> {
    throw new Error('not implemented')
  }
}
