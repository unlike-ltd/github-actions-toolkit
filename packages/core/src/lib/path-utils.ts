import path from 'node:path'

/**
 * toPosixPath converts the given path to the posix form. On Windows, \\ will be
 * replaced with /.
 *
 * @param pth. Path to transform.
 * @return string Posix path.
 */
export const toPosixPath = (pth: string): string => {
  return pth.replaceAll('\\', '/')
}

/**
 * toWin32Path converts the given path to the win32 form. On Linux, / will be
 * replaced with \\.
 *
 * @param pth. Path to transform.
 * @return string Win32 path.
 */
export const toWin32Path = (pth: string): string => {
  return pth.replaceAll('/', '\\')
}

/**
 * toPlatformPath converts the given path to a platform-specific path. It does
 * this by replacing instances of / and \ with the platform-specific path
 * separator.
 *
 * @param pth The path to platformize.
 * @return string The platform-specific path.
 */
export const toPlatformPath = (pth: string): string => {
  return pth.replaceAll(/[/\\]/g, path.sep)
}
