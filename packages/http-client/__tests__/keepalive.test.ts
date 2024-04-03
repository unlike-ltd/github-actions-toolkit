/* eslint-disable vitest/prefer-expect-assertions */

import {afterEach, beforeEach, describe, expect, test} from 'vitest'

import * as httpm from '../dist/index.js'

describe('basics', () => {
  let _http: httpm.HttpClient

  beforeEach(() => {
    _http = new httpm.HttpClient('http-client-tests', [], {keepAlive: true})
  })

  afterEach(() => {
    _http.dispose()
  })

  test.each([true, false])('creates Agent with keepAlive %s', keepAlive => {
    const http = new httpm.HttpClient('http-client-tests', [], {keepAlive})
    const agent = http.getAgent('http://postman-echo.com')
    expect(agent).toHaveProperty('keepAlive', keepAlive)
  })

  test('does basic http get request with keepAlive true', async () => {
    const res: httpm.HttpClientResponse = await _http.get(
      'http://postman-echo.com/get'
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    expect(obj.url).toBe('http://postman-echo.com/get')
  })

  test('does basic head request with keepAlive true', async () => {
    const res: httpm.HttpClientResponse = await _http.head(
      'http://postman-echo.com/get'
    )
    expect(res.message.statusCode).toBe(200)
  })

  test('does basic http delete request with keepAlive true', async () => {
    const res: httpm.HttpClientResponse = await _http.del(
      'http://postman-echo.com/delete'
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    JSON.parse(body)
  })

  test('does basic http post request with keepAlive true', async () => {
    const b = 'Hello World!'
    const res: httpm.HttpClientResponse = await _http.post(
      'http://postman-echo.com/post',
      b
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    expect(obj.data).toBe(b)
    expect(obj.url).toBe('http://postman-echo.com/post')
  })

  test('does basic http patch request with keepAlive true', async () => {
    const b = 'Hello World!'
    const res: httpm.HttpClientResponse = await _http.patch(
      'http://postman-echo.com/patch',
      b
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    expect(obj.data).toBe(b)
    expect(obj.url).toBe('http://postman-echo.com/patch')
  })

  test('does basic http options request with keepAlive true', async () => {
    const res: httpm.HttpClientResponse = await _http.options(
      'http://postman-echo.com'
    )
    expect(res.message.statusCode).toBe(200)
    await res.readBody()
  })
})
