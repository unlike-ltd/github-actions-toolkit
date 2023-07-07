import fs from 'node:fs'
import {lstat, readdir, stat} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

export {
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  readdir,
  readlink,
  rename,
  rm,
  rmdir,
  stat,
  symlink,
  unlink
} from 'node:fs/promises'

export const IS_WINDOWS = process.platform === 'win32'
// See https://github.com/nodejs/node/blob/d0153aee367422d0858105abec186da4dff0a0c5/deps/uv/include/uv/win.h#L691
// eslint-disable-next-line unicorn/numeric-separators-style
export const UV_FS_O_EXLOCK = 0x10000000
export const READONLY = fs.constants.O_RDONLY

type OurError = Error & {code: string}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hasErrorCode = (err: any): err is OurError => {
  return err && typeof err === 'object' && 'code' in err
}

export const exists = async (fsPath: string): Promise<boolean> => {
  try {
    await stat(fsPath)
  } catch (error) {
    if (hasErrorCode(error) && error.code === 'ENOENT') {
      return false
    }

    throw error
  }

  return true
}

export const isDirectory = async (
  fsPath: string,
  useStat = false
): Promise<boolean> => {
  const stats = useStat ? await stat(fsPath) : await lstat(fsPath)
  return stats.isDirectory()
}

/**
 * On OSX/Linux, true if path starts with '/'. On Windows, true for paths like:
 * \, \hello, \\hello\share, C:, and C:\hello (and corresponding alternate separator cases).
 */
export const isRooted = (p: string): boolean => {
  p = normalizeSeparators(p)
  if (!p) {
    throw new Error('isRooted() parameter "p" cannot be empty')
  }

  if (IS_WINDOWS) {
    return (
      p.startsWith('\\') || /^[a-z]:/i.test(p) // e.g. \ or \hello or \\hello
    ) // e.g. C: or C:\hello
  }

  return p.startsWith('/')
}

/**
 * Best effort attempt to determine whether a file exists and is executable.
 * @param filePath    file path to check
 * @param extensions  additional file extensions to try
 * @return if file exists and is executable, returns the file path. otherwise empty string.
 */
export const tryGetExecutablePath = async (
  filePath: string,
  extensions: string[]
): Promise<string> => {
  let stats: fs.Stats | undefined
  try {
    // test file exists
    stats = await stat(filePath)
  } catch (error) {
    if (hasErrorCode(error) && error.code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.log(
        `Unexpected error attempting to determine if executable file exists '${filePath}': ${error}`
      )
    }
  }
  if (stats && stats.isFile()) {
    if (IS_WINDOWS) {
      // on Windows, test for valid extension
      const upperExt = path.extname(filePath).toUpperCase()
      if (extensions.some(validExt => validExt.toUpperCase() === upperExt)) {
        return filePath
      }
    } else {
      if (isUnixExecutable(stats)) {
        return filePath
      }
    }
  }

  // try each extension
  const originalFilePath = filePath
  for (const extension of extensions) {
    filePath = originalFilePath + extension

    stats = undefined
    try {
      stats = await stat(filePath)
    } catch (error) {
      if (hasErrorCode(error) && error.code !== 'ENOENT') {
        // eslint-disable-next-line no-console
        console.log(
          `Unexpected error attempting to determine if executable file exists '${filePath}': ${error}`
        )
      }
    }

    if (stats && stats.isFile()) {
      if (IS_WINDOWS) {
        // preserve the case of the actual file (since an extension was appended)
        try {
          const directory = path.dirname(filePath)
          const upperName = path.basename(filePath).toUpperCase()
          for (const actualName of await readdir(directory)) {
            if (upperName === actualName.toUpperCase()) {
              filePath = path.join(directory, actualName)
              break
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log(
            `Unexpected error attempting to determine the actual case of the file '${filePath}': ${error}`
          )
        }

        return filePath
      } else {
        if (isUnixExecutable(stats)) {
          return filePath
        }
      }
    }
  }

  return ''
}

function normalizeSeparators(p = ''): string {
  if (IS_WINDOWS) {
    // convert slashes on Windows
    p = p.replaceAll('/', '\\')

    // remove redundant slashes
    return p.replaceAll(/\\\\+/g, '\\')
  }

  // remove redundant slashes
  return p.replaceAll(/\/\/+/g, '/')
}

// on Mac/Linux, test the execute bit
//     R   W  X  R  W X R W X
//   256 128 64 32 16 8 4 2 1
function isUnixExecutable(stats: fs.Stats): boolean {
  const gid = process.getgid && process.getgid()
  return (
    (stats.mode & 1) > 0 ||
    ((stats.mode & 8) > 0 && stats.gid === gid) ||
    ((stats.mode & 64) > 0 && stats.uid === gid)
  )
}

// Get the path of cmd.exe in windows
export const getCmdPath = (): string => {
  return process.env['COMSPEC'] ?? `cmd.exe`
}
