/* eslint-disable vitest/prefer-lowercase-title */
/* eslint-disable vitest/prefer-expect-assertions */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {HttpClientResponse} from '../src/index.js'

import http from 'node:http'

import proxy from 'proxy'
import {ProxyAgent} from 'undici'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test
} from 'vitest'

import {HttpClient} from '../src/index.js'
import {checkBypass, getProxyUrl} from '../src/proxy.js'

let _proxyConnects: string[]
let _proxyServer: http.Server
const _proxyUrl = 'http://127.0.0.1:8080'

describe('proxy', () => {
  beforeAll(async () => {
    // Start proxy server
    _proxyServer = proxy.createProxy()
    await new Promise<void>(resolve => {
      const port = Number(_proxyUrl.split(':')[2])
      _proxyServer.listen(port, () => resolve())
    })
    _proxyServer.on('connect', req => {
      _proxyConnects.push(req.url ?? '')
    })
  })

  beforeEach(() => {
    _proxyConnects = []
    _clearVars()
  })

  afterEach(() => {})

  afterAll(async () => {
    _clearVars()

    // Stop proxy server
    await new Promise<void>(resolve => {
      _proxyServer.once('close', () => resolve())
      _proxyServer.close()
    })
  })

  test('getProxyUrl does not return proxyUrl if variables not set', () => {
    const proxyUrl = getProxyUrl(new URL('https://github.com'))
    expect(proxyUrl).toBeUndefined()
  })

  test('getProxyUrl returns proxyUrl if https_proxy set for https url', () => {
    process.env['https_proxy'] = 'https://myproxysvr'
    const proxyUrl = getProxyUrl(new URL('https://github.com'))
    expect(proxyUrl).toBeDefined()
  })

  test('getProxyUrl does not return proxyUrl if http_proxy set for https url', () => {
    process.env['http_proxy'] = 'https://myproxysvr'
    const proxyUrl = getProxyUrl(new URL('https://github.com'))
    expect(proxyUrl).toBeUndefined()
  })

  test('getProxyUrl returns proxyUrl if http_proxy set for http url', () => {
    process.env['http_proxy'] = 'http://myproxysvr'
    const proxyUrl = getProxyUrl(new URL('http://github.com'))
    expect(proxyUrl).toBeDefined()
  })

  test('getProxyUrl does not return proxyUrl if https_proxy set and in no_proxy list', () => {
    process.env['https_proxy'] = 'https://myproxysvr'
    process.env['no_proxy'] = 'otherserver,myserver,anotherserver:8080'
    const proxyUrl = getProxyUrl(new URL('https://myserver'))
    expect(proxyUrl).toBeUndefined()
  })

  test('getProxyUrl returns proxyUrl if https_proxy set and not in no_proxy list', () => {
    process.env['https_proxy'] = 'https://myproxysvr'
    process.env['no_proxy'] = 'otherserver,myserver,anotherserver:8080'
    const proxyUrl = getProxyUrl(new URL('https://github.com'))
    expect(proxyUrl).toBeDefined()
  })

  test('getProxyUrl does not return proxyUrl if http_proxy set and in no_proxy list', () => {
    process.env['http_proxy'] = 'http://myproxysvr'
    process.env['no_proxy'] = 'otherserver,myserver,anotherserver:8080'
    const proxyUrl = getProxyUrl(new URL('http://myserver'))
    expect(proxyUrl).toBeUndefined()
  })

  test('getProxyUrl returns proxyUrl if http_proxy set and not in no_proxy list', () => {
    process.env['http_proxy'] = 'http://myproxysvr'
    process.env['no_proxy'] = 'otherserver,myserver,anotherserver:8080'
    const proxyUrl = getProxyUrl(new URL('http://github.com'))
    expect(proxyUrl).toBeDefined()
  })

  test('getProxyUrl returns proxyUrl if http_proxy has no protocol', () => {
    process.env['http_proxy'] = 'myproxysvr'
    const proxyUrl = getProxyUrl(new URL('http://github.com'))
    expect(proxyUrl?.toString()).toBe('http://myproxysvr/')
  })

  test('checkBypass returns true if host as no_proxy list', () => {
    process.env['no_proxy'] = 'myserver'
    const bypass = checkBypass(new URL('https://myserver'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns true if host in no_proxy list', () => {
    process.env['no_proxy'] = 'otherserver,myserver,anotherserver:8080'
    const bypass = checkBypass(new URL('https://myserver'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns true if host in no_proxy list with spaces', () => {
    process.env['no_proxy'] = 'otherserver, myserver ,anotherserver:8080'
    const bypass = checkBypass(new URL('https://myserver'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns true if host in no_proxy list with port', () => {
    process.env['no_proxy'] = 'otherserver, myserver:8080 ,anotherserver'
    const bypass = checkBypass(new URL('https://myserver:8080'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns true if host with port in no_proxy list without port', () => {
    process.env['no_proxy'] = 'otherserver, myserver ,anotherserver'
    const bypass = checkBypass(new URL('https://myserver:8080'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns true if host in no_proxy list with default https port', () => {
    process.env['no_proxy'] = 'otherserver, myserver:443 ,anotherserver'
    const bypass = checkBypass(new URL('https://myserver'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns true if host in no_proxy list with default http port', () => {
    process.env['no_proxy'] = 'otherserver, myserver:80 ,anotherserver'
    const bypass = checkBypass(new URL('http://myserver'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns false if host not in no_proxy list', () => {
    process.env['no_proxy'] = 'otherserver, myserver ,anotherserver:8080'
    const bypass = checkBypass(new URL('https://github.com'))
    expect(bypass).toBeFalsy()
  })

  test('checkBypass returns false if empty no_proxy', () => {
    process.env['no_proxy'] = ''
    const bypass = checkBypass(new URL('https://github.com'))
    expect(bypass).toBeFalsy()
  })

  test('checkBypass returns true if host with subdomain in no_proxy', () => {
    process.env['no_proxy'] = 'myserver.com'
    const bypass = checkBypass(new URL('https://sub.myserver.com'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns false if no_proxy is subdomain', () => {
    process.env['no_proxy'] = 'myserver.com'
    const bypass = checkBypass(new URL('https://myserver.com.evil.org'))
    expect(bypass).toBeFalsy()
  })

  test('checkBypass returns false if no_proxy is part of domain', () => {
    process.env['no_proxy'] = 'myserver.com'
    const bypass = checkBypass(new URL('https://evilmyserver.com'))
    expect(bypass).toBeFalsy()
  })

  // Do not strip leading dots as per https://github.com/actions/runner/blob/97195bad5870e2ad0915ebfef1616083aacf5818/docs/adrs/0263-proxy-support.md
  test('checkBypass returns false if host with leading dot in no_proxy', () => {
    process.env['no_proxy'] = '.myserver.com'
    const bypass = checkBypass(new URL('https://myserver.com'))
    expect(bypass).toBeFalsy()
  })

  test('checkBypass returns true if host with subdomain in no_proxy defined with leading "."', () => {
    process.env['no_proxy'] = '.myserver.com'
    const bypass = checkBypass(new URL('https://sub.myserver.com'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns true if no_proxy is "*"', () => {
    process.env['no_proxy'] = '*'
    const bypass = checkBypass(new URL('https://anything.whatsoever.com'))
    expect(bypass).toBeTruthy()
  })

  test('checkBypass returns true if no_proxy contains comma separated "*"', () => {
    process.env['no_proxy'] = 'domain.com,* , example.com'
    const bypass = checkBypass(new URL('https://anything.whatsoever.com'))
    expect(bypass).toBeTruthy()
  })

  test('HttpClient does basic http get request through proxy', async () => {
    process.env['http_proxy'] = _proxyUrl
    const httpClient = new HttpClient()
    const res: HttpClientResponse = await httpClient.get(
      'http://postman-echo.com/get'
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    expect(obj.url).toBe('http://postman-echo.com/get')
    expect(_proxyConnects).toStrictEqual(['postman-echo.com:80'])
  })

  test('HttpClient does basic http get request when bypass proxy', async () => {
    process.env['http_proxy'] = _proxyUrl
    process.env['no_proxy'] = 'postman-echo.com'
    const httpClient = new HttpClient()
    const res: HttpClientResponse = await httpClient.get(
      'http://postman-echo.com/get'
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    expect(obj.url).toBe('http://postman-echo.com/get')
    expect(_proxyConnects).toHaveLength(0)
  })

  test('HttpClient does basic https get request through proxy', async () => {
    process.env['https_proxy'] = _proxyUrl
    const httpClient = new HttpClient()
    const res: HttpClientResponse = await httpClient.get(
      'https://postman-echo.com/get'
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    expect(obj.url).toBe('https://postman-echo.com/get')
    expect(_proxyConnects).toStrictEqual(['postman-echo.com:443'])
  })

  test('HttpClient does basic https get request when bypass proxy', async () => {
    process.env['https_proxy'] = _proxyUrl
    process.env['no_proxy'] = 'postman-echo.com'
    const httpClient = new HttpClient()
    const res: HttpClientResponse = await httpClient.get(
      'https://postman-echo.com/get'
    )
    expect(res.message.statusCode).toBe(200)
    const body: string = await res.readBody()
    const obj = JSON.parse(body)
    expect(obj.url).toBe('https://postman-echo.com/get')
    expect(_proxyConnects).toHaveLength(0)
  })

  test('HttpClient bypasses proxy for loopback addresses (localhost, ::1, 127.*)', async () => {
    // setup a server listening on localhost:8091
    const server = http.createServer((request, response) => {
      response.writeHead(200)
      request.pipe(response)
    })
    server.listen(8091)
    try {
      process.env['http_proxy'] = _proxyUrl
      const httpClient = new HttpClient()
      let res = await httpClient.get('http://localhost:8091')
      expect(res.message.statusCode).toBe(200)
      res = await httpClient.get('http://127.0.0.1:8091')
      expect(res.message.statusCode).toBe(200)

      // no support for ipv6 for now
      // eslint-disable-next-line vitest/require-to-throw-message
      expect(httpClient.get('http://[::1]:8091')).rejects.toThrow()

      // proxy at _proxyUrl was ignored
      expect(_proxyConnects).toStrictEqual([])
    } finally {
      server.close()
    }
  })

  test('proxyAuth not set in tunnel agent when authentication is not provided', async () => {
    process.env['https_proxy'] = 'http://127.0.0.1:8080'
    const httpClient = new HttpClient()
    const agent: any = httpClient.getAgent('https://some-url')
    // console.log(agent)
    expect(agent.proxyOptions.host).toBe('127.0.0.1')
    expect(agent.proxyOptions.port).toBe(8080)
    expect(agent.proxyOptions.proxyAuth).toBeUndefined()
  })

  test('proxyAuth is set in tunnel agent when authentication is provided', async () => {
    process.env['https_proxy'] = 'http://user:password@127.0.0.1:8080'
    const httpClient = new HttpClient()
    const agent: any = httpClient.getAgent('https://some-url')

    // console.log(agent)
    expect(agent.proxyOptions.host).toBe('127.0.0.1')
    expect(agent.proxyOptions.port).toBe(8080)
    expect(agent.proxyOptions.proxyAuth).toBe('user:password')
  })

  test('ProxyAgent is returned when proxy setting are provided', async () => {
    process.env['https_proxy'] = 'http://127.0.0.1:8080'
    const httpClient = new HttpClient()
    const agent = httpClient.getAgentDispatcher('https://some-url')

    // console.log(agent)
    expect(agent instanceof ProxyAgent).toBe(true)
  })
})

function _clearVars(): void {
  delete process.env['http_proxy']
  delete process.env['HTTP_PROXY']
  delete process.env['https_proxy']
  delete process.env['HTTPS_PROXY']
  delete process.env['no_proxy']
  delete process.env['NO_PROXY']
}
