/* eslint-disable vitest/prefer-expect-assertions */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {beforeEach, describe, expect, test} from 'vitest'

import {Headers, HttpClient, MediaTypes} from '../src/index.js'

describe('headers', () => {
  let _http: HttpClient

  beforeEach(() => {
    _http = new HttpClient('http-client-tests')
  })

  test('preserves existing headers on getJson', async () => {
    const additionalHeaders = {[Headers.Accept]: 'foo'}
    let jsonObj = await _http.getJson<any>(
      'https://postman-echo.com/get',
      additionalHeaders
    )
    expect(jsonObj.result.headers[Headers.Accept]).toBe('foo')
    expect(jsonObj.headers[Headers.ContentType]).toContain(
      MediaTypes.ApplicationJson
    )

    const httpWithHeaders = new HttpClient()
    httpWithHeaders.requestOptions = {
      headers: {
        [Headers.Accept]: 'baz'
      }
    }
    jsonObj = await httpWithHeaders.getJson<any>('https://postman-echo.com/get')
    expect(jsonObj.result.headers[Headers.Accept]).toBe('baz')
    expect(jsonObj.headers[Headers.ContentType]).toContain(
      MediaTypes.ApplicationJson
    )
  })

  test('preserves existing headers on postJson', async () => {
    const additionalHeaders = {[Headers.Accept]: 'foo'}
    let jsonObj = await _http.postJson<any>(
      'https://postman-echo.com/post',
      {},
      additionalHeaders
    )
    expect(jsonObj.result.headers[Headers.Accept]).toBe('foo')
    expect(jsonObj.headers[Headers.ContentType]).toContain(
      MediaTypes.ApplicationJson
    )

    const httpWithHeaders = new HttpClient()
    httpWithHeaders.requestOptions = {
      headers: {
        [Headers.Accept]: 'baz'
      }
    }
    jsonObj = await httpWithHeaders.postJson<any>(
      'https://postman-echo.com/post',
      {}
    )
    expect(jsonObj.result.headers[Headers.Accept]).toBe('baz')
    expect(jsonObj.headers[Headers.ContentType]).toContain(
      MediaTypes.ApplicationJson
    )
  })

  test('preserves existing headers on putJson', async () => {
    const additionalHeaders = {[Headers.Accept]: 'foo'}
    let jsonObj = await _http.putJson<any>(
      'https://postman-echo.com/put',
      {},
      additionalHeaders
    )
    expect(jsonObj.result.headers[Headers.Accept]).toBe('foo')
    expect(jsonObj.headers[Headers.ContentType]).toContain(
      MediaTypes.ApplicationJson
    )

    const httpWithHeaders = new HttpClient()
    httpWithHeaders.requestOptions = {
      headers: {
        [Headers.Accept]: 'baz'
      }
    }
    jsonObj = await httpWithHeaders.putJson<any>(
      'https://postman-echo.com/put',
      {}
    )
    expect(jsonObj.result.headers[Headers.Accept]).toBe('baz')
    expect(jsonObj.headers[Headers.ContentType]).toContain(
      MediaTypes.ApplicationJson
    )
  })

  test('preserves existing headers on patchJson', async () => {
    const additionalHeaders = {[Headers.Accept]: 'foo'}
    let jsonObj = await _http.patchJson<any>(
      'https://postman-echo.com/patch',
      {},
      additionalHeaders
    )
    expect(jsonObj.result.headers[Headers.Accept]).toBe('foo')
    expect(jsonObj.headers[Headers.ContentType]).toContain(
      MediaTypes.ApplicationJson
    )

    const httpWithHeaders = new HttpClient()
    httpWithHeaders.requestOptions = {
      headers: {
        [Headers.Accept]: 'baz'
      }
    }
    jsonObj = await httpWithHeaders.patchJson<any>(
      'https://postman-echo.com/patch',
      {}
    )
    expect(jsonObj.result.headers[Headers.Accept]).toBe('baz')
    expect(jsonObj.headers[Headers.ContentType]).toContain(
      MediaTypes.ApplicationJson
    )
  })
})
