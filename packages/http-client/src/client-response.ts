import type {IncomingMessage} from 'node:http'

export class HttpClientResponse {
  constructor(message: IncomingMessage) {
    this.message = message
  }

  message: IncomingMessage
  async readBody(): Promise<string> {
    return new Promise<string>(resolve => {
      let output = Buffer.alloc(0)

      this.message.on('data', (chunk: Buffer) => {
        output = Buffer.concat([output, chunk])
      })

      this.message.on('end', () => {
        resolve(output.toString())
      })
    })
  }

  async readBodyBuffer?(): Promise<Buffer> {
    return new Promise<Buffer>(resolve => {
      const chunks: Buffer[] = []

      this.message.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      this.message.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
    })
  }
}
