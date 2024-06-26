import type {RequestOptions} from '@unlike/github-actions-http-client'

import {
  BearerCredentialHandler,
  HttpClient
} from '@unlike/github-actions-http-client'

import {debug} from './logging.js'
import {setSecret} from './variables.js'

interface TokenResponse {
  value?: string
}

export class OidcClient {
  static #createHttpClient(allowRetry = true, maxRetry = 10): HttpClient {
    const requestOptions: RequestOptions = {
      allowRetries: allowRetry,
      maxRetries: maxRetry
    }

    return new HttpClient(
      'actions/oidc-client',
      [new BearerCredentialHandler(OidcClient.#getRequestToken())],
      requestOptions
    )
  }

  static #getRequestToken(): string {
    const token = process.env['ACTIONS_ID_TOKEN_REQUEST_TOKEN']
    if (!token) {
      throw new Error(
        'Unable to get ACTIONS_ID_TOKEN_REQUEST_TOKEN env variable'
      )
    }
    return token
  }

  static #getIDTokenUrl(): string {
    const runtimeUrl = process.env['ACTIONS_ID_TOKEN_REQUEST_URL']
    if (!runtimeUrl) {
      throw new Error('Unable to get ACTIONS_ID_TOKEN_REQUEST_URL env variable')
    }
    return runtimeUrl
  }

  static async #getCall(id_token_url: string): Promise<string> {
    const httpclient = OidcClient.#createHttpClient()

    const res = await httpclient
      .getJson<TokenResponse>(id_token_url)
      .catch(error => {
        throw new Error(
          `Failed to get ID Token. \n
        Error Code : ${error.statusCode}\n
        Error Message: ${error.result.message}`
        )
      })

    const id_token = res.result?.value
    if (!id_token) {
      throw new Error('Response json body do not have ID Token field')
    }
    return id_token
  }

  static async getIDToken(audience?: string): Promise<string> {
    try {
      // New ID Token is requested from action service
      let id_token_url: string = OidcClient.#getIDTokenUrl()
      if (audience) {
        const encodedAudience = encodeURIComponent(audience)
        id_token_url = `${id_token_url}&audience=${encodedAudience}`
      }

      debug(`ID token url is ${id_token_url}`)

      const id_token = await OidcClient.#getCall(id_token_url)
      setSecret(id_token)
      return id_token
    } catch (error) {
      if (error instanceof Error) {
        throw new TypeError(`Error message: ${error.message}`)
      }

      throw new Error(`Error message: unknown error`)
    }
  }
}
