/* eslint-disable vitest/prefer-expect-assertions */

import type {HttpClientResponse} from '../src/client-response.js'

import {describe, expect, test} from 'vitest'

import {
  BasicCredentialHandler,
  BearerCredentialHandler,
  PersonalAccessTokenCredentialHandler
} from '../src/auth.js'
import {HttpClient} from '../src/client.js'

describe('auth', () => {
  test('does basic http get request with basic auth', async () => {
    const bh: BasicCredentialHandler = new BasicCredentialHandler(
      'johndoe',
      'password'
    )
    const http: HttpClient = new HttpClient('http-client-tests', [bh])
    const res: HttpClientResponse = await http.get(
      'http://postman-echo.com/get'
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    const auth: string = obj.headers.authorization
    const creds: string = Buffer.from(
      auth.substring('Basic '.length),
      'base64'
    ).toString()
    expect(creds).toBe('johndoe:password')
    expect(obj.url).toBe('http://postman-echo.com/get')
  })

  test('does basic http get request with pat token auth', async () => {
    const token = 'scbfb44vxzku5l4xgc3qfazn3lpk4awflfryc76esaiq7aypcbhs'
    const ph: PersonalAccessTokenCredentialHandler =
      new PersonalAccessTokenCredentialHandler(token)

    const http: HttpClient = new HttpClient('http-client-tests', [ph])
    const res: HttpClientResponse = await http.get(
      'http://postman-echo.com/get'
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    const auth: string = obj.headers.authorization
    const creds: string = Buffer.from(
      auth.substring('Basic '.length),
      'base64'
    ).toString()
    expect(creds).toBe(`PAT:${token}`)
    expect(obj.url).toBe('http://postman-echo.com/get')
  })

  test('does basic http get request with pat token auth', async () => {
    const token = 'scbfb44vxzku5l4xgc3qfazn3lpk4awflfryc76esaiq7aypcbhs'
    const ph: BearerCredentialHandler = new BearerCredentialHandler(token)

    const http: HttpClient = new HttpClient('http-client-tests', [ph])
    const res: HttpClientResponse = await http.get(
      'http://postman-echo.com/get'
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    const auth: string = obj.headers.authorization
    expect(auth).toBe(`Bearer ${token}`)
    expect(obj.url).toBe('http://postman-echo.com/get')
  })
})
