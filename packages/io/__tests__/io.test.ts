/* eslint-disable unicorn/prefer-ternary */
/* eslint-disable vitest/no-conditional-expect */
/* eslint-disable vitest/no-conditional-in-test */
/* eslint-disable vitest/no-conditional-tests */
/* eslint-disable unicorn/no-await-expression-member */

import child from 'node:child_process'
import {promises as fs} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import url from 'node:url'

import {beforeAll, describe, expect, test, vi} from 'vitest'

import * as ioUtil from '../src/io-util.js'
import * as io from '../src/io.js'

describe('cp', () => {
  beforeAll(async () => {
    await io.rmRF(getTestTemp())
  })

  test('copies file with no flags', async () => {
    const root = path.join(getTestTemp(), 'cp_with_no_flags')
    const sourceFile = path.join(root, 'cp_source')
    const targetFile = path.join(root, 'cp_target')
    await io.mkdirP(root)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})

    await io.cp(sourceFile, targetFile)

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
  })

  test('copies file using -f', async () => {
    const root: string = path.join(path.join(__dirname, '_temp'), 'cp_with_-f')
    const sourceFile: string = path.join(root, 'cp_source')
    const targetFile: string = path.join(root, 'cp_target')
    await io.mkdirP(root)
    await fs.writeFile(sourceFile, 'test file content')

    await io.cp(sourceFile, targetFile, {recursive: false, force: true})

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
  })

  test('copies file into directory', async () => {
    const root: string = path.join(
      path.join(__dirname, '_temp'),
      'cp_file_to_directory'
    )
    const sourceFile: string = path.join(root, 'cp_source')
    const targetDirectory: string = path.join(root, 'cp_target')
    const targetFile: string = path.join(targetDirectory, 'cp_source')
    await io.mkdirP(targetDirectory)
    await fs.writeFile(sourceFile, 'test file content')

    await io.cp(sourceFile, targetDirectory, {recursive: false, force: true})

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
  })

  test('try copying to existing file with -n', async () => {
    const root: string = path.join(getTestTemp(), 'cp_to_existing')
    const sourceFile: string = path.join(root, 'cp_source')
    const targetFile: string = path.join(root, 'cp_target')
    await io.mkdirP(root)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})
    await fs.writeFile(targetFile, 'correct content', {encoding: 'utf8'})
    await io.cp(sourceFile, targetFile, {recursive: false, force: false})

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'correct content'
    )
  })

  test('copies directory into existing destination with -r', async () => {
    const root: string = path.join(getTestTemp(), 'cp_with_-r_existing_dest')
    const sourceFolder: string = path.join(root, 'cp_source')
    const sourceFile: string = path.join(sourceFolder, 'cp_source_file')

    const targetFolder: string = path.join(root, 'cp_target')
    const targetFile: string = path.join(
      targetFolder,
      'cp_source',
      'cp_source_file'
    )
    await io.mkdirP(sourceFolder)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})
    await io.mkdirP(targetFolder)
    await io.cp(sourceFolder, targetFolder, {recursive: true})

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
  })

  test('copies directory into existing destination with -r without copying source directory', async () => {
    const root: string = path.join(
      getTestTemp(),
      'cp_with_-r_existing_dest_no_source_dir'
    )
    const sourceFolder: string = path.join(root, 'cp_source')
    const sourceFile: string = path.join(sourceFolder, 'cp_source_file')

    const targetFolder: string = path.join(root, 'cp_target')
    const targetFile: string = path.join(targetFolder, 'cp_source_file')
    await io.mkdirP(sourceFolder)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})
    await io.mkdirP(targetFolder)
    await io.cp(sourceFolder, targetFolder, {
      recursive: true,
      copySourceDirectory: false
    })

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
  })

  test('copies directory into non-existing destination with -r', async () => {
    const root: string = path.join(getTestTemp(), 'cp_with_-r_nonexistent_dest')
    const sourceFolder: string = path.join(root, 'cp_source')
    const sourceFile: string = path.join(sourceFolder, 'cp_source_file')

    const targetFolder: string = path.join(root, 'cp_target')
    const targetFile: string = path.join(targetFolder, 'cp_source_file')
    await io.mkdirP(sourceFolder)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})
    await io.cp(sourceFolder, targetFolder, {recursive: true})

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
  })

  test('tries to copy directory without -r', async () => {
    const root: string = path.join(getTestTemp(), 'cp_without_-r')
    const sourceFolder: string = path.join(root, 'cp_source')
    const sourceFile: string = path.join(sourceFolder, 'cp_source_file')

    const targetFolder: string = path.join(root, 'cp_target')
    const targetFile: string = path.join(
      targetFolder,
      'cp_source',
      'cp_source_file'
    )
    await io.mkdirP(sourceFolder)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})

    await expect(io.cp(sourceFolder, targetFolder)).rejects.toThrow(
      'Failed to copy'
    )
    await assertNotExists(targetFile)
  })

  test('copies symlinks correctly', async () => {
    // create the following layout
    // sourceFolder
    // sourceFolder/nested
    // sourceFolder/nested/sourceFile
    // sourceFolder/symlinkDirectory -> sourceFile
    const root: string = path.join(getTestTemp(), 'cp_with_-r_symlinks')
    const sourceFolder: string = path.join(root, 'cp_source')
    const nestedFolder: string = path.join(sourceFolder, 'nested')
    const sourceFile: string = path.join(nestedFolder, 'cp_source_file')
    const symlinkDirectory: string = path.join(sourceFolder, 'symlinkDirectory')

    const targetFolder: string = path.join(root, 'cp_target')
    const targetFile: string = path.join(
      targetFolder,
      'nested',
      'cp_source_file'
    )
    const symlinkTargetPath: string = path.join(
      targetFolder,
      'symlinkDirectory',
      'cp_source_file'
    )
    await io.mkdirP(sourceFolder)
    await io.mkdirP(nestedFolder)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})
    await createSymlinkDir(nestedFolder, symlinkDirectory)
    await io.cp(sourceFolder, targetFolder, {recursive: true})

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
    await expect(
      fs.readFile(symlinkTargetPath, {encoding: 'utf8'})
    ).resolves.toBe('test file content')
  })
})

describe('mv', () => {
  beforeAll(async () => {
    await io.rmRF(getTestTemp())
  })

  test('moves file with no flags', async () => {
    const root = path.join(getTestTemp(), ' mv_with_no_flags')
    const sourceFile = path.join(root, ' mv_source')
    const targetFile = path.join(root, ' mv_target')
    await io.mkdirP(root)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})

    await io.mv(sourceFile, targetFile)

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
    await assertNotExists(sourceFile)
  })

  test('moves file using -f', async () => {
    const root: string = path.join(path.join(__dirname, '_temp'), ' mv_with_-f')
    const sourceFile: string = path.join(root, ' mv_source')
    const targetFile: string = path.join(root, ' mv_target')
    await io.mkdirP(root)
    await fs.writeFile(sourceFile, 'test file content')

    await io.mv(sourceFile, targetFile)

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )

    await assertNotExists(sourceFile)
  })

  test('try moving to existing file with -n', async () => {
    const root: string = path.join(getTestTemp(), ' mv_to_existing')
    const sourceFile: string = path.join(root, ' mv_source')
    const targetFile: string = path.join(root, ' mv_target')
    await io.mkdirP(root)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})
    await fs.writeFile(targetFile, 'correct content', {encoding: 'utf8'})
    let failed = false
    try {
      await io.mv(sourceFile, targetFile, {force: false})
    } catch {
      failed = true
    }
    expect(failed).toBe(true)

    await expect(fs.readFile(sourceFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'correct content'
    )
  })

  test('moves directory into existing destination', async () => {
    const root: string = path.join(getTestTemp(), ' mv_with_-r_existing_dest')
    const sourceFolder: string = path.join(root, ' mv_source')
    const sourceFile: string = path.join(sourceFolder, ' mv_source_file')

    const targetFolder: string = path.join(root, ' mv_target')
    const targetFile: string = path.join(
      targetFolder,
      ' mv_source',
      ' mv_source_file'
    )
    await io.mkdirP(sourceFolder)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})
    await io.mkdirP(targetFolder)
    await io.mv(sourceFolder, targetFolder)

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
    await assertNotExists(sourceFile)
  })

  test('moves directory into non-existing destination', async () => {
    const root: string = path.join(
      getTestTemp(),
      ' mv_with_-r_nonexistent_dest'
    )
    const sourceFolder: string = path.join(root, ' mv_source')
    const sourceFile: string = path.join(sourceFolder, ' mv_source_file')

    const targetFolder: string = path.join(root, ' mv_target')
    const targetFile: string = path.join(targetFolder, ' mv_source_file')
    await io.mkdirP(sourceFolder)
    await fs.writeFile(sourceFile, 'test file content', {encoding: 'utf8'})
    await io.mv(sourceFolder, targetFolder)

    await expect(fs.readFile(targetFile, {encoding: 'utf8'})).resolves.toBe(
      'test file content'
    )
    await assertNotExists(sourceFile)
  })
})

describe('rmRF', () => {
  beforeAll(async () => {
    await io.rmRF(getTestTemp())
  })

  test('removes single folder with rmRF', async () => {
    const testPath = path.join(getTestTemp(), 'testFolder')

    await io.mkdirP(testPath)
    await assertExists(testPath)

    await io.rmRF(testPath)
    await assertNotExists(testPath)
  })

  test('removes recursive folders with rmRF', async () => {
    const testPath = path.join(getTestTemp(), 'testDir1')
    const testPath2 = path.join(testPath, 'testDir2')
    await io.mkdirP(testPath2)

    await assertExists(testPath)
    await assertExists(testPath2)

    await io.rmRF(testPath)
    await assertNotExists(testPath)
    await assertNotExists(testPath2)
  })

  test('removes folder with locked file with rmRF', async () => {
    const testPath = path.join(getTestTemp(), 'testFolder')
    await io.mkdirP(testPath)
    await assertExists(testPath)

    // can't remove folder with locked file on windows
    const filePath = path.join(testPath, 'file.txt')
    await fs.appendFile(filePath, 'some data')
    await assertExists(filePath)

    // For windows we need to explicitly set an exclusive lock flag, because by default Node will open the file with the 'Delete' FileShare flag.
    // See the exclusive lock windows flag definition:
    // https://github.com/nodejs/node/blob/c2e4b1fa9ad0b744616c4e4c13a5017772a630c4/deps/uv/src/win/fs.c#L499-L513
    const fd = await fs.open(
      filePath,
      fs.constants.O_RDONLY | ioUtil.UV_FS_O_EXLOCK
    )
    // eslint-disable-next-line vitest/no-conditional-tests, vitest/no-conditional-in-test
    if (ioUtil.IS_WINDOWS) {
      // On Windows, we expect an error due to an lstat call implementation in the underlying libuv code.
      // See https://github.com/libuv/libuv/issues/3267 is resolved
      // eslint-disable-next-line vitest/no-conditional-expect
      await expect(io.rmRF(testPath)).rejects.toThrow('EBUSY')
    } else {
      await io.rmRF(testPath)

      await assertNotExists(testPath)
    }
    await fd.close()
    await io.rmRF(testPath)
    await assertNotExists(testPath)
  })

  test('removes folder that does not exist with rmRF', async () => {
    const testPath = path.join(getTestTemp(), 'testFolder')
    await assertNotExists(testPath)

    await io.rmRF(testPath)
    await assertNotExists(testPath)
  })

  test('removes file with rmRF', async () => {
    const file: string = path.join(getTestTemp(), 'rmRF_file')
    await fs.writeFile(file, 'test file content')
    await assertExists(file)
    await io.rmRF(file)
    await assertNotExists(file)
  })

  test('removes hidden folder with rmRF', async () => {
    const directory: string = path.join(getTestTemp(), '.rmRF_directory')
    await createHiddenDirectory(directory)
    await assertExists(directory)
    await io.rmRF(directory)
    await assertNotExists(directory)
  })

  test('removes hidden file with rmRF', async () => {
    const file: string = path.join(getTestTemp(), '.rmRF_file')
    await fs.writeFile(file, 'test file content')
    await assertExists(file)
    await io.rmRF(file)
    await assertNotExists(file)
  })

  // creating a symlink to a file on Windows requires elevated
  // eslint-disable-next-line vitest/require-hook
  describe.skipIf(os.platform() === 'win32')('symlink', () => {
    test('removes symlink file with rmRF', async () => {
      // create the following layout:
      //   real_file
      //   symlink_file -> real_file
      const root: string = path.join(getTestTemp(), 'rmRF_sym_file_test')
      const realFile: string = path.join(root, 'real_file')
      const symlinkFile: string = path.join(root, 'symlink_file')
      await io.mkdirP(root)
      await fs.writeFile(realFile, 'test file content')
      await fs.symlink(realFile, symlinkFile)
      await expect(fs.readFile(symlinkFile, {encoding: 'utf8'})).resolves.toBe(
        'test file content'
      )

      await io.rmRF(symlinkFile)
      await assertExists(realFile)
      await assertNotExists(symlinkFile)
    })

    test('removes symlink file with missing source using rmRF', async () => {
      // create the following layout:
      //   real_file
      //   symlink_file -> real_file
      const root: string = path.join(
        getTestTemp(),
        'rmRF_sym_file_missing_source_test'
      )
      const realFile: string = path.join(root, 'real_file')
      const symlinkFile: string = path.join(root, 'symlink_file')
      await io.mkdirP(root)
      await fs.writeFile(realFile, 'test file content')
      await fs.symlink(realFile, symlinkFile)
      await expect(fs.readFile(symlinkFile, {encoding: 'utf8'})).resolves.toBe(
        'test file content'
      )

      // remove the real file
      await fs.unlink(realFile)
      // eslint-disable-next-line unicorn/no-await-expression-member
      expect((await fs.lstat(symlinkFile)).isSymbolicLink()).toBe(true)

      // remove the symlink file
      await io.rmRF(symlinkFile)

      await expect(fs.lstat(symlinkFile)).rejects.toThrow('ENOENT')
    })

    test('removes symlink level 2 file with rmRF', async () => {
      // create the following layout:
      //   real_file
      //   symlink_file -> real_file
      //   symlink_level_2_file -> symlink_file
      const root: string = path.join(
        getTestTemp(),
        'rmRF_sym_level_2_file_test'
      )
      const realFile: string = path.join(root, 'real_file')
      const symlinkFile: string = path.join(root, 'symlink_file')
      const symlinkLevel2File: string = path.join(root, 'symlink_level_2_file')
      await io.mkdirP(root)
      await fs.writeFile(realFile, 'test file content')
      await fs.symlink(realFile, symlinkFile)
      await fs.symlink(symlinkFile, symlinkLevel2File)
      await expect(
        fs.readFile(symlinkLevel2File, {encoding: 'utf8'})
      ).resolves.toBe('test file content')

      await io.rmRF(symlinkLevel2File)
      await assertExists(realFile)
      await assertExists(symlinkFile)
      await assertNotExists(symlinkLevel2File)
    })

    test('removes nested symlink file with rmRF', async () => {
      // create the following layout:
      //   real_directory
      //   real_directory/real_file
      //   outer_directory
      //   outer_directory/symlink_file -> real_file
      const root: string = path.join(getTestTemp(), 'rmRF_sym_nest_file_test')
      const realDirectory: string = path.join(root, 'real_directory')
      const realFile: string = path.join(root, 'real_directory', 'real_file')
      const outerDirectory: string = path.join(root, 'outer_directory')
      const symlinkFile: string = path.join(
        root,
        'outer_directory',
        'symlink_file'
      )
      await io.mkdirP(realDirectory)
      await fs.writeFile(realFile, 'test file content')
      await io.mkdirP(outerDirectory)
      await fs.symlink(realFile, symlinkFile)
      await expect(fs.readFile(symlinkFile, {encoding: 'utf8'})).resolves.toBe(
        'test file content'
      )

      await io.rmRF(outerDirectory)
      await assertExists(realDirectory)
      await assertExists(realFile)
      await assertNotExists(symlinkFile)
      await assertNotExists(outerDirectory)
    })

    test('removes deeply nested symlink file with rmRF', async () => {
      // create the following layout:
      //   real_directory
      //   real_directory/real_file
      //   outer_directory
      //   outer_directory/nested_directory
      //   outer_directory/nested_directory/symlink_file -> real_file
      const root: string = path.join(
        getTestTemp(),
        'rmRF_sym_deep_nest_file_test'
      )
      const realDirectory: string = path.join(root, 'real_directory')
      const realFile: string = path.join(root, 'real_directory', 'real_file')
      const outerDirectory: string = path.join(root, 'outer_directory')
      const nestedDirectory: string = path.join(
        root,
        'outer_directory',
        'nested_directory'
      )
      const symlinkFile: string = path.join(
        root,
        'outer_directory',
        'nested_directory',
        'symlink_file'
      )
      await io.mkdirP(realDirectory)
      await fs.writeFile(realFile, 'test file content')
      await io.mkdirP(nestedDirectory)
      await fs.symlink(realFile, symlinkFile)
      await expect(fs.readFile(symlinkFile, {encoding: 'utf8'})).resolves.toBe(
        'test file content'
      )

      await io.rmRF(outerDirectory)
      await assertExists(realDirectory)
      await assertExists(realFile)
      await assertNotExists(symlinkFile)
      await assertNotExists(outerDirectory)
    })
  })

  // eslint-disable-next-line vitest/require-hook
  describe.skipIf(os.platform() !== 'win32')('symlink', () => {
    test('correctly escapes % on windows', async () => {
      const root: string = path.join(getTestTemp(), 'rmRF_escape_test_win')
      const directory: string = path.join(root, '%test%')
      await io.mkdirP(root)
      await io.mkdirP(directory)
      const oldEnv = process.env['test']
      process.env['test'] = 'thisshouldnotresolve'

      await io.rmRF(directory)
      await assertNotExists(directory)
      process.env['test'] = oldEnv
    })

    test('should throw for invalid characters', async () => {
      const root: string = path.join(getTestTemp(), 'rmRF_invalidChar_Windows')
      const errorString =
        'File path must not contain `*`, `"`, `<`, `>` or `|` on Windows'
      await expect(io.rmRF(path.join(root, '"'))).rejects.toHaveProperty(
        'message',
        errorString
      )
      await expect(io.rmRF(path.join(root, '<'))).rejects.toHaveProperty(
        'message',
        errorString
      )
      await expect(io.rmRF(path.join(root, '>'))).rejects.toHaveProperty(
        'message',
        errorString
      )
      await expect(io.rmRF(path.join(root, '|'))).rejects.toHaveProperty(
        'message',
        errorString
      )
      await expect(io.rmRF(path.join(root, '*'))).rejects.toHaveProperty(
        'message',
        errorString
      )
    })
  })

  test('removes symlink folder with missing source using rmRF', async () => {
    expect.assertions(3)
    // create the following layout:
    //   real_directory
    //   real_directory/real_file
    //   symlink_directory -> real_directory
    const root: string = path.join(getTestTemp(), 'rmRF_sym_dir_miss_src_test')
    const realDirectory: string = path.join(root, 'real_directory')
    const realFile: string = path.join(root, 'real_directory', 'real_file')
    const symlinkDirectory: string = path.join(root, 'symlink_directory')
    await io.mkdirP(realDirectory)
    await fs.writeFile(realFile, 'test file content')
    await createSymlinkDir(realDirectory, symlinkDirectory)
    await assertExists(symlinkDirectory)

    // remove the real directory
    await fs.unlink(realFile)
    await fs.rmdir(realDirectory)

    await expect(fs.stat(symlinkDirectory)).rejects.toThrow('ENOENT')

    // lstat shouldn't throw
    await fs.lstat(symlinkDirectory)

    // remove the symlink directory
    await io.rmRF(symlinkDirectory)
    await expect(fs.lstat(symlinkDirectory)).rejects.toThrow('ENOENT')
  })

  test('removes symlink level 2 folder with rmRF', async () => {
    // create the following layout:
    //   real_directory
    //   real_directory/real_file
    //   symlink_directory -> real_directory
    //   symlink_level_2_directory -> symlink_directory
    const root: string = path.join(
      getTestTemp(),
      'rmRF_sym_level_2_directory_test'
    )
    const realDirectory: string = path.join(root, 'real_directory')
    const realFile: string = path.join(realDirectory, 'real_file')
    const symlinkDirectory: string = path.join(root, 'symlink_directory')
    const symlinkLevel2Directory: string = path.join(
      root,
      'symlink_level_2_directory'
    )
    await io.mkdirP(realDirectory)
    await fs.writeFile(realFile, 'test file content')
    await createSymlinkDir(realDirectory, symlinkDirectory)
    await createSymlinkDir(symlinkDirectory, symlinkLevel2Directory)
    await expect(
      fs.readFile(path.join(symlinkDirectory, 'real_file'), {
        encoding: 'utf8'
      })
    ).resolves.toBe('test file content')
    if (os.platform() === 'win32') {
      await expect(fs.readlink(symlinkLevel2Directory)).resolves.toBe(
        `${symlinkDirectory}\\`
      )
    } else {
      await expect(fs.readlink(symlinkLevel2Directory)).resolves.toBe(
        symlinkDirectory
      )
    }

    await io.rmRF(symlinkLevel2Directory)
    await assertExists(path.join(symlinkDirectory, 'real_file'))
    await assertNotExists(symlinkLevel2Directory)
  })

  test('removes nested symlink folder with rmRF', async () => {
    // create the following layout:
    //   real_directory
    //   real_directory/real_file
    //   outer_directory
    //   outer_directory/symlink_directory -> real_directory
    const root: string = path.join(getTestTemp(), 'rmRF_sym_nest_dir_test')
    const realDirectory: string = path.join(root, 'real_directory')
    const realFile: string = path.join(root, 'real_directory', 'real_file')
    const outerDirectory: string = path.join(root, 'outer_directory')
    const symlinkDirectory: string = path.join(
      root,
      'outer_directory',
      'symlink_directory'
    )
    await io.mkdirP(realDirectory)
    await fs.writeFile(realFile, 'test file content')
    await io.mkdirP(outerDirectory)
    await createSymlinkDir(realDirectory, symlinkDirectory)
    await assertExists(path.join(symlinkDirectory, 'real_file'))

    await io.rmRF(outerDirectory)
    await assertExists(realDirectory)
    await assertExists(realFile)
    await assertNotExists(symlinkDirectory)
    await assertNotExists(outerDirectory)
  })

  test('removes deeply nested symlink folder with rmRF', async () => {
    // create the following layout:
    //   real_directory
    //   real_directory/real_file
    //   outer_directory
    //   outer_directory/nested_directory
    //   outer_directory/nested_directory/symlink_directory -> real_directory
    const root: string = path.join(getTestTemp(), 'rmRF_sym_deep_nest_dir_test')
    const realDirectory: string = path.join(root, 'real_directory')
    const realFile: string = path.join(root, 'real_directory', 'real_file')
    const outerDirectory: string = path.join(root, 'outer_directory')
    const nestedDirectory: string = path.join(
      root,
      'outer_directory',
      'nested_directory'
    )
    const symlinkDirectory: string = path.join(
      root,
      'outer_directory',
      'nested_directory',
      'symlink_directory'
    )
    await io.mkdirP(realDirectory)
    await fs.writeFile(realFile, 'test file content')
    await io.mkdirP(nestedDirectory)
    await createSymlinkDir(realDirectory, symlinkDirectory)
    await assertExists(path.join(symlinkDirectory, 'real_file'))

    await io.rmRF(outerDirectory)
    await assertExists(realDirectory)
    await assertExists(realFile)
    await assertNotExists(symlinkDirectory)
    await assertNotExists(outerDirectory)
  })

  test('removes hidden file with rmRF', async () => {
    const file: string = path.join(getTestTemp(), '.rmRF_file')
    await io.mkdirP(path.dirname(file))
    await createHiddenFile(file, 'test file content')
    await assertExists(file)
    await io.rmRF(file)
    await assertNotExists(file)
  })
})

describe('mkdirP', () => {
  beforeAll(async () => {
    await io.rmRF(getTestTemp())
  })

  test('fails when called with an empty path', async () => {
    expect.assertions(1)

    await expect(io.mkdirP('')).rejects.toThrow(
      'a path argument must be provided'
    )
  })

  test('creates folder', async () => {
    const testPath = path.join(getTestTemp(), 'mkdirTest')
    await io.mkdirP(testPath)

    await assertExists(testPath)
  })

  test('creates nested folders with mkdirP', async () => {
    const testPath = path.join(getTestTemp(), 'mkdir1', 'mkdir2')
    await io.mkdirP(testPath)

    await assertExists(testPath)
  })

  test('fails if mkdirP with illegal chars', async () => {
    expect.assertions(1)

    const testPath = path.join(getTestTemp(), 'mkdir\0')

    await expect(fs.stat(testPath)).rejects.toHaveProperty(
      'code',
      'ERR_INVALID_ARG_VALUE'
    )
  })

  test('fails if mkdirP with conflicting file path', async () => {
    expect.assertions(1)

    const testPath = path.join(getTestTemp(), 'mkdirP_conflicting_file_path')
    await io.mkdirP(getTestTemp())
    await fs.writeFile(testPath, '')

    await expect(io.mkdirP(testPath)).rejects.toThrow('EEXIST:')
  })

  test('fails if mkdirP with conflicting parent file path', async () => {
    expect.assertions(1)

    const testPath = path.join(
      getTestTemp(),
      'mkdirP_conflicting_parent_file_path',
      'dir'
    )
    await io.mkdirP(getTestTemp())
    await fs.writeFile(path.dirname(testPath), '')
    await expect(io.mkdirP(testPath)).rejects.toThrow('ENOTDIR:')
  })

  test('no-ops if mkdirP directory exists', async () => {
    const testPath = path.join(getTestTemp(), 'mkdirP_dir_exists')
    await io.mkdirP(testPath)
    await assertExists(testPath)

    // Calling again shouldn't throw
    await io.mkdirP(testPath)
    await assertExists(testPath)
  })

  test('no-ops if mkdirP with symlink directory', async () => {
    // create the following layout:
    //   real_dir
    //   real_dir/file.txt
    //   symlink_dir -> real_dir
    const rootPath = path.join(getTestTemp(), 'mkdirP_symlink_dir')
    const realDirPath = path.join(rootPath, 'real_dir')
    const realFilePath = path.join(realDirPath, 'file.txt')
    const symlinkDirPath = path.join(rootPath, 'symlink_dir')
    await io.mkdirP(getTestTemp())
    await fs.mkdir(rootPath)
    await fs.mkdir(realDirPath)
    await fs.writeFile(realFilePath, 'test real_dir/file.txt content')
    await createSymlinkDir(realDirPath, symlinkDirPath)

    await io.mkdirP(symlinkDirPath)

    // the file in the real directory should still be accessible via the symlink
    expect((await fs.lstat(symlinkDirPath)).isSymbolicLink()).toBe(true)
    expect(
      (await fs.stat(path.join(symlinkDirPath, 'file.txt'))).isFile()
    ).toBe(true)
  })

  test('no-ops if mkdirP with parent symlink directory', async () => {
    // create the following layout:
    //   real_dir
    //   real_dir/file.txt
    //   symlink_dir -> real_dir
    const rootPath = path.join(getTestTemp(), 'mkdirP_parent_symlink_dir')
    const realDirPath = path.join(rootPath, 'real_dir')
    const realFilePath = path.join(realDirPath, 'file.txt')
    const symlinkDirPath = path.join(rootPath, 'symlink_dir')
    await io.mkdirP(getTestTemp())
    await fs.mkdir(rootPath)
    await fs.mkdir(realDirPath)
    await fs.writeFile(realFilePath, 'test real_dir/file.txt content')
    await createSymlinkDir(realDirPath, symlinkDirPath)

    const subDirPath = path.join(symlinkDirPath, 'sub_dir')
    await io.mkdirP(subDirPath)

    // the subdirectory should be accessible via the real directory
    expect(
      (await fs.lstat(path.join(realDirPath, 'sub_dir'))).isDirectory()
    ).toBe(true)
  })
})

describe('which', () => {
  beforeAll(async () => {
    await io.rmRF(getTestTemp())
  })

  test('which() finds file name', async () => {
    // create a executable file
    const testPath = path.join(getTestTemp(), 'which-finds-file-name')
    await io.mkdirP(testPath)
    let fileName = 'Which-Test-File'
    if (process.platform === 'win32') {
      fileName += '.exe'
    }

    const filePath = path.join(testPath, fileName)
    await fs.writeFile(filePath, '')
    if (process.platform !== 'win32') {
      chmod(filePath, '+x')
    }

    const originalPath = process.env['PATH']
    try {
      // update the PATH
      process.env['PATH'] = `${process.env['PATH']}${path.delimiter}${testPath}`

      // exact file name
      await expect(io.which(fileName)).resolves.toBe(filePath)
      await expect(io.which(fileName, false)).resolves.toBe(filePath)
      await expect(io.which(fileName, true)).resolves.toBe(filePath)

      if (process.platform === 'win32') {
        // not case sensitive on windows
        await expect(io.which('which-test-file.exe')).resolves.toBe(
          path.join(testPath, 'which-test-file.exe')
        )
        await expect(io.which('WHICH-TEST-FILE.EXE')).resolves.toBe(
          path.join(testPath, 'WHICH-TEST-FILE.EXE')
        )
        await expect(io.which('WHICH-TEST-FILE.EXE', false)).resolves.toBe(
          path.join(testPath, 'WHICH-TEST-FILE.EXE')
        )
        await expect(io.which('WHICH-TEST-FILE.EXE', true)).resolves.toBe(
          path.join(testPath, 'WHICH-TEST-FILE.EXE')
        )

        // without extension
        await expect(io.which('which-test-file')).resolves.toBe(filePath)
        await expect(io.which('which-test-file', false)).resolves.toBe(filePath)
        await expect(io.which('which-test-file', true)).resolves.toBe(filePath)
      } else if (process.platform === 'darwin') {
        // not case sensitive on Mac
        await expect(io.which(fileName.toUpperCase())).resolves.toBe(
          path.join(testPath, fileName.toUpperCase())
        )
        await expect(io.which(fileName.toUpperCase(), false)).resolves.toBe(
          path.join(testPath, fileName.toUpperCase())
        )
        await expect(io.which(fileName.toUpperCase(), true)).resolves.toBe(
          path.join(testPath, fileName.toUpperCase())
        )
      } else {
        // case sensitive on Linux
        await expect(io.which(fileName.toUpperCase())).resolves.toBe('')
      }
    } finally {
      process.env['PATH'] = originalPath
    }
  })

  test('which() not found', async () => {
    await expect(io.which('which-test-no-such-file')).resolves.toBe('')
    await expect(io.which('which-test-no-such-file', false)).resolves.toBe('')
    await expect(
      io.which('which-test-no-such-file', true)
    ).rejects.toBeDefined()
  })

  test('which() searches path in order', async () => {
    // create a chcp.com/bash override file
    const testPath = path.join(getTestTemp(), 'which-searches-path-in-order')
    await io.mkdirP(testPath)
    let fileName
    if (process.platform === 'win32') {
      fileName = 'chcp.com'
    } else {
      fileName = 'bash'
    }

    const filePath = path.join(testPath, fileName)
    await fs.writeFile(filePath, '')
    if (process.platform !== 'win32') {
      chmod(filePath, '+x')
    }

    const originalPath = process.env['PATH']
    try {
      // sanity - regular chcp.com/bash should be found
      const originalWhich = await io.which(fileName)
      expect(!!(originalWhich || '')).toBe(true)

      // modify PATH
      process.env['PATH'] = [testPath, process.env['PATH']].join(path.delimiter)

      // override chcp.com/bash should be found
      await expect(io.which(fileName)).resolves.toBe(filePath)
    } finally {
      process.env['PATH'] = originalPath
    }
  })

  test('which() requires executable', async () => {
    // create a non-executable file
    // on Windows, should not end in valid PATHEXT
    // on Mac/Linux should not have executable bit
    const testPath = path.join(getTestTemp(), 'which-requires-executable')
    await io.mkdirP(testPath)
    let fileName = 'Which-Test-File'
    if (process.platform === 'win32') {
      fileName += '.abc' // not a valid PATHEXT
    }

    const filePath = path.join(testPath, fileName)
    await fs.writeFile(filePath, '')
    if (process.platform !== 'win32') {
      chmod(filePath, '-x')
    }

    const originalPath = process.env['PATH']
    try {
      // modify PATH
      process.env['PATH'] = [process.env['PATH'], testPath].join(path.delimiter)

      // should not be found
      await expect(io.which(fileName)).resolves.toBe('')
    } finally {
      process.env['PATH'] = originalPath
    }
  })

  // which permissions tests
  test('which() finds executable with different permissions', async () => {
    await findsExecutableWithScopedPermissions('u=rwx,g=r,o=r')
    await findsExecutableWithScopedPermissions('u=rw,g=rx,o=r')
    await findsExecutableWithScopedPermissions('u=rw,g=r,o=rx')
  })

  test('which() ignores directory match', async () => {
    // create a directory
    const testPath = path.join(getTestTemp(), 'which-ignores-directory-match')
    let dirPath = path.join(testPath, 'Which-Test-Dir')
    if (process.platform === 'win32') {
      dirPath += '.exe'
    }

    await io.mkdirP(dirPath)
    if (process.platform !== 'win32') {
      chmod(dirPath, '+x')
    }

    const originalPath = process.env['PATH']
    try {
      // modify PATH
      process.env['PATH'] = [process.env['PATH'], testPath].join(path.delimiter)

      // should not be found
      await expect(io.which(path.basename(dirPath))).resolves.toBe('')
    } finally {
      process.env['PATH'] = originalPath
    }
  })

  test('which() allows rooted path', async () => {
    // create an executable file
    const testPath = path.join(getTestTemp(), 'which-allows-rooted-path')
    await io.mkdirP(testPath)
    let filePath = path.join(testPath, 'Which-Test-File')
    if (process.platform === 'win32') {
      filePath += '.exe'
    }

    await fs.writeFile(filePath, '')
    if (process.platform !== 'win32') {
      chmod(filePath, '+x')
    }

    // which the full path
    await expect(io.which(filePath)).resolves.toBe(filePath)
    await expect(io.which(filePath, false)).resolves.toBe(filePath)
    await expect(io.which(filePath, true)).resolves.toBe(filePath)
  })

  test('which() requires rooted path to be executable', async () => {
    expect.assertions(3)

    // create a non-executable file
    // on Windows, should not end in valid PATHEXT
    // on Mac/Linux, should not have executable bit
    const testPath = path.join(
      getTestTemp(),
      'which-requires-rooted-path-to-be-executable'
    )
    await io.mkdirP(testPath)
    let filePath = path.join(testPath, 'Which-Test-File')
    if (process.platform === 'win32') {
      filePath += '.abc' // not a valid PATHEXT
    }

    await fs.writeFile(filePath, '')
    if (process.platform !== 'win32') {
      chmod(filePath, '-x')
    }

    // should not be found
    await expect(io.which(filePath)).resolves.toBe('')
    await expect(io.which(filePath, false)).resolves.toBe('')

    // eslint-disable-next-line vitest/require-to-throw-message
    await expect(io.which(filePath, true)).rejects.toThrow()
  })

  test('which() requires rooted path to be a file', async () => {
    expect.assertions(3)

    // create a dir
    const testPath = path.join(
      getTestTemp(),
      'which-requires-rooted-path-to-be-executable'
    )
    let dirPath = path.join(testPath, 'Which-Test-Dir')
    if (process.platform === 'win32') {
      dirPath += '.exe'
    }

    await io.mkdirP(dirPath)
    if (process.platform !== 'win32') {
      chmod(dirPath, '+x')
    }

    // should not be found
    await expect(io.which(dirPath)).resolves.toBe('')
    await expect(io.which(dirPath, false)).resolves.toBe('')
    await expect(io.which(dirPath, true)).rejects.toThrow(
      'Unable to locate executable file:'
    )
  })

  test('which() requires rooted path to exist', async () => {
    expect.assertions(3)

    let filePath = path.join(__dirname, 'no-such-file')
    if (process.platform === 'win32') {
      filePath += '.exe'
    }

    await expect(io.which(filePath)).resolves.toBe('')
    await expect(io.which(filePath, false)).resolves.toBe('')

    await expect(io.which(filePath, true)).rejects.toThrow(
      'Unable to locate executable file:'
    )
  })

  test('which() does not allow separators', async () => {
    // create an executable file
    const testDirName = 'which-does-not-allow-separators'
    const testPath = path.join(getTestTemp(), testDirName)
    await io.mkdirP(testPath)
    let fileName = 'Which-Test-File'
    if (process.platform === 'win32') {
      fileName += '.exe'
    }

    const filePath = path.join(testPath, fileName)
    await fs.writeFile(filePath, '')
    if (process.platform !== 'win32') {
      chmod(filePath, '+x')
    }

    const originalPath = process.env['PATH']
    try {
      // modify PATH
      process.env['PATH'] = [process.env['PATH'], testPath].join(path.delimiter)

      // which "dir/file", should not be found
      await expect(io.which(`${testDirName}/${fileName}`)).resolves.toBe('')

      // on Windows, also try "dir\file"
      if (process.platform === 'win32') {
        await expect(io.which(`${testDirName}\\${fileName}`)).resolves.toBe('')
      }
    } finally {
      process.env['PATH'] = originalPath
    }
  })

  if (process.platform === 'win32') {
    test('which() resolves actual case file name when extension is applied', async () => {
      const comspec: string = process.env['ComSpec'] || ''
      expect(!!comspec).toBe(true)
      await expect(io.which('CmD.eXe')).resolves.toBe(
        path.join(path.dirname(comspec), 'CmD.eXe')
      )
      await expect(io.which('CmD')).resolves.toBe(comspec)
    })

    test('which() appends ext on windows', async () => {
      // create executable files
      const testPath = path.join(getTestTemp(), 'which-appends-ext-on-windows')
      await io.mkdirP(testPath)
      // PATHEXT=.COM;.EXE;.BAT;.CMD...
      const files: {[key: string]: string} = {
        'which-test-file-1': path.join(testPath, 'which-test-file-1.com'),
        'which-test-file-2': path.join(testPath, 'which-test-file-2.exe'),
        'which-test-file-3': path.join(testPath, 'which-test-file-3.bat'),
        'which-test-file-4': path.join(testPath, 'which-test-file-4.cmd'),
        'which-test-file-5.txt': path.join(
          testPath,
          'which-test-file-5.txt.com'
        )
      }
      for (const fileName of Object.keys(files)) {
        const file = files[fileName] as string
        await fs.writeFile(file, '')
      }

      const originalPath = process.env['PATH']
      try {
        // modify PATH
        process.env[
          'PATH'
        ] = `${process.env['PATH']}${path.delimiter}${testPath}`

        // find each file
        for (const fileName of Object.keys(files)) {
          await expect(io.which(fileName)).resolves.toBe(files[fileName])
        }
      } finally {
        process.env['PATH'] = originalPath
      }
    })

    test('which() appends ext on windows when rooted', async () => {
      // create executable files
      const testPath = path.join(
        getTestTemp(),
        'which-appends-ext-on-windows-when-rooted'
      )
      await io.mkdirP(testPath)
      // PATHEXT=.COM;.EXE;.BAT;.CMD...
      const files: {[key: string]: string} = {}
      files[path.join(testPath, 'which-test-file-1')] = path.join(
        testPath,
        'which-test-file-1.com'
      )
      files[path.join(testPath, 'which-test-file-2')] = path.join(
        testPath,
        'which-test-file-2.exe'
      )
      files[path.join(testPath, 'which-test-file-3')] = path.join(
        testPath,
        'which-test-file-3.bat'
      )
      files[path.join(testPath, 'which-test-file-4')] = path.join(
        testPath,
        'which-test-file-4.cmd'
      )
      files[path.join(testPath, 'which-test-file-5.txt')] = path.join(
        testPath,
        'which-test-file-5.txt.com'
      )
      for (const fileName of Object.keys(files)) {
        const file = files[fileName] as string
        await fs.writeFile(file, '')
      }

      // find each file
      for (const fileName of Object.keys(files)) {
        await expect(io.which(fileName)).resolves.toBe(files[fileName])
      }
    })

    test('which() prefer exact match on windows', async () => {
      // create two executable files:
      //   which-test-file.bat
      //   which-test-file.bat.exe
      //
      // verify "which-test-file.bat" returns that file, and not "which-test-file.bat.exe"
      //
      // preference, within the same dir, should be given to the exact match (even though
      // .EXE is defined with higher preference than .BAT in PATHEXT (PATHEXT=.COM;.EXE;.BAT;.CMD...)
      const testPath = path.join(
        getTestTemp(),
        'which-prefer-exact-match-on-windows'
      )
      await io.mkdirP(testPath)
      const fileName = 'which-test-file.bat'
      const expectedFilePath = path.join(testPath, fileName)
      const notExpectedFilePath = path.join(testPath, `${fileName}.exe`)
      await fs.writeFile(expectedFilePath, '')
      await fs.writeFile(notExpectedFilePath, '')
      const originalPath = process.env['PATH']
      try {
        process.env[
          'PATH'
        ] = `${process.env['PATH']}${path.delimiter}${testPath}`
        await expect(io.which(fileName)).resolves.toBe(expectedFilePath)
      } finally {
        process.env['PATH'] = originalPath
      }
    })

    test('which() prefer exact match on windows when rooted', async () => {
      // create two executable files:
      //   which-test-file.bat
      //   which-test-file.bat.exe
      //
      // verify "which-test-file.bat" returns that file, and not "which-test-file.bat.exe"
      //
      // preference, within the same dir, should be given to the exact match (even though
      // .EXE is defined with higher preference than .BAT in PATHEXT (PATHEXT=.COM;.EXE;.BAT;.CMD...)
      const testPath = path.join(
        getTestTemp(),
        'which-prefer-exact-match-on-windows-when-rooted'
      )
      await io.mkdirP(testPath)
      const fileName = 'which-test-file.bat'
      const expectedFilePath = path.join(testPath, fileName)
      const notExpectedFilePath = path.join(testPath, `${fileName}.exe`)
      await fs.writeFile(expectedFilePath, '')
      await fs.writeFile(notExpectedFilePath, '')
      await expect(io.which(path.join(testPath, fileName))).resolves.toBe(
        expectedFilePath
      )
    })

    test('which() searches ext in order', async () => {
      const testPath = path.join(getTestTemp(), 'which-searches-ext-in-order')

      // create a directory for testing .COM order preference
      // PATHEXT=.COM;.EXE;.BAT;.CMD...
      const fileNameWithoutExtension = 'which-test-file'
      const comTestPath = path.join(testPath, 'com-test')
      await io.mkdirP(comTestPath)
      await fs.writeFile(
        path.join(comTestPath, `${fileNameWithoutExtension}.com`),
        ''
      )
      await fs.writeFile(
        path.join(comTestPath, `${fileNameWithoutExtension}.exe`),
        ''
      )
      await fs.writeFile(
        path.join(comTestPath, `${fileNameWithoutExtension}.bat`),
        ''
      )
      await fs.writeFile(
        path.join(comTestPath, `${fileNameWithoutExtension}.cmd`),
        ''
      )

      // create a directory for testing .EXE order preference
      // PATHEXT=.COM;.EXE;.BAT;.CMD...
      const exeTestPath = path.join(testPath, 'exe-test')
      await io.mkdirP(exeTestPath)
      await fs.writeFile(
        path.join(exeTestPath, `${fileNameWithoutExtension}.exe`),
        ''
      )
      await fs.writeFile(
        path.join(exeTestPath, `${fileNameWithoutExtension}.bat`),
        ''
      )
      await fs.writeFile(
        path.join(exeTestPath, `${fileNameWithoutExtension}.cmd`),
        ''
      )

      // create a directory for testing .BAT order preference
      // PATHEXT=.COM;.EXE;.BAT;.CMD...
      const batTestPath = path.join(testPath, 'bat-test')
      await io.mkdirP(batTestPath)
      await fs.writeFile(
        path.join(batTestPath, `${fileNameWithoutExtension}.bat`),
        ''
      )
      await fs.writeFile(
        path.join(batTestPath, `${fileNameWithoutExtension}.cmd`),
        ''
      )

      // create a directory for testing .CMD
      const cmdTestPath = path.join(testPath, 'cmd-test')
      await io.mkdirP(cmdTestPath)
      const cmdFilePath = path.join(
        cmdTestPath,
        `${fileNameWithoutExtension}.cmd`
      )
      await fs.writeFile(cmdFilePath, '')

      const originalPath = process.env['PATH']
      try {
        // test .COM
        process.env['PATH'] = `${comTestPath}${path.delimiter}${originalPath}`
        await expect(io.which(fileNameWithoutExtension)).resolves.toBe(
          path.join(comTestPath, `${fileNameWithoutExtension}.com`)
        )

        // test .EXE
        process.env['PATH'] = `${exeTestPath}${path.delimiter}${originalPath}`
        await expect(io.which(fileNameWithoutExtension)).resolves.toBe(
          path.join(exeTestPath, `${fileNameWithoutExtension}.exe`)
        )

        // test .BAT
        process.env['PATH'] = `${batTestPath}${path.delimiter}${originalPath}`
        await expect(io.which(fileNameWithoutExtension)).resolves.toBe(
          path.join(batTestPath, `${fileNameWithoutExtension}.bat`)
        )

        // test .CMD
        process.env['PATH'] = `${cmdTestPath}${path.delimiter}${originalPath}`
        await expect(io.which(fileNameWithoutExtension)).resolves.toBe(
          path.join(cmdTestPath, `${fileNameWithoutExtension}.cmd`)
        )
      } finally {
        process.env['PATH'] = originalPath
      }
    })
  }
})

describe('findInPath', () => {
  beforeAll(async () => {
    await io.rmRF(getTestTemp())
  })

  test('findInPath() not found', async () => {
    await expect(
      io.findInPath('findInPath-test-no-such-file')
    ).resolves.toStrictEqual([])
  })

  test('findInPath() finds file names', async () => {
    // create executable files
    let fileName = 'FindInPath-Test-File'
    if (process.platform === 'win32') {
      fileName += '.exe'
    }

    const testPaths = ['1', '2', '3'].map(count =>
      path.join(getTestTemp(), `findInPath-finds-file-names-${count}`)
    )
    for (const testPath of testPaths) {
      await io.mkdirP(testPath)
    }

    const filePaths = testPaths.map(testPath => path.join(testPath, fileName))
    for (const filePath of filePaths) {
      await fs.writeFile(filePath, '')
      if (process.platform !== 'win32') {
        chmod(filePath, '+x')
      }
    }

    const originalPath = process.env['PATH']
    try {
      // update the PATH
      for (const testPath of testPaths) {
        process.env[
          'PATH'
        ] = `${process.env['PATH']}${path.delimiter}${testPath}`
      }
      // exact file names
      await expect(io.findInPath(fileName)).resolves.toStrictEqual(filePaths)
    } finally {
      process.env['PATH'] = originalPath
    }
  })
})

const findsExecutableWithScopedPermissions = async (
  chmodOptions: string
): Promise<void> => {
  // create a executable file
  const testPath = path.join(getTestTemp(), 'which-finds-file-name')
  await io.mkdirP(testPath)
  const fileName = 'Which-Test-File'
  if (process.platform === 'win32') {
    return
  }

  const filePath = path.join(testPath, fileName)
  await fs.writeFile(filePath, '')
  chmod(filePath, chmodOptions)

  try {
    // update the PATH
    vi.stubEnv('PATH', `${process.env['PATH']}${path.delimiter}${testPath}`)

    // exact file name
    await expect(io.which(fileName)).resolves.toBe(filePath)
    await expect(io.which(fileName, false)).resolves.toBe(filePath)
    await expect(io.which(fileName, true)).resolves.toBe(filePath)

    if (process.platform === 'darwin') {
      // not case sensitive on Mac
      await expect(io.which(fileName.toUpperCase())).resolves.toBe(
        path.join(testPath, fileName.toUpperCase())
      )
      await expect(io.which(fileName.toUpperCase(), false)).resolves.toBe(
        path.join(testPath, fileName.toUpperCase())
      )
      await expect(io.which(fileName.toUpperCase(), true)).resolves.toBe(
        path.join(testPath, fileName.toUpperCase())
      )
    } else {
      // case sensitive on Linux
      await expect(io.which(fileName.toUpperCase())).resolves.toBe('')
    }
  } finally {
    vi.unstubAllEnvs()
  }
}

// Assert that a file exists
async function assertExists(filePath: string): Promise<void> {
  await expect(fs.stat(filePath)).resolves.toBeDefined()
}

// Assert that reading a file raises an ENOENT error (does not exist)
async function assertNotExists(filePath: string): Promise<void> {
  await expect(fs.stat(filePath)).rejects.toHaveProperty('code', 'ENOENT')
}

function chmod(file: string, mode: string): void {
  const result = child.spawnSync('chmod', [mode, file])
  if (result.status !== 0) {
    const message: string = (result.output || []).join(' ').trim()
    throw new Error(`Command failed: "chmod ${mode} ${file}".  ${message}`)
  }
}

async function createHiddenDirectory(dir: string): Promise<void> {
  if (!/^\./.test(path.basename(dir))) {
    throw new Error(`Expected dir '${dir}' to start with '.'.`)
  }

  await io.mkdirP(dir)
  if (os.platform() === 'win32') {
    const result = child.spawnSync('attrib.exe', ['+H', dir])
    if (result.status !== 0) {
      const message: string = (result.output || []).join(' ').trim()
      throw new Error(
        `Failed to set hidden attribute for directory '${dir}'. ${message}`
      )
    }
  }
}

async function createHiddenFile(file: string, content: string): Promise<void> {
  if (!/^\./.test(path.basename(file))) {
    throw new Error(`Expected dir '${file}' to start with '.'.`)
  }

  await io.mkdirP(path.dirname(file))
  await fs.writeFile(file, content)

  if (os.platform() === 'win32') {
    const result = child.spawnSync('attrib.exe', ['+H', file])
    if (result.status !== 0) {
      const message: string = (result.output || []).join(' ').trim()
      throw new Error(
        `Failed to set hidden attribute for file '${file}'. ${message}`
      )
    }
  }
}

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
function getTestTemp(): string {
  return path.join(__dirname, '_temp')
}

/**
 * Creates a symlink directory on OSX/Linux, and a junction point directory on Windows.
 * A symlink directory is not created on Windows since it requires an elevated context.
 */
async function createSymlinkDir(real: string, link: string): Promise<void> {
  if (os.platform() === 'win32') {
    await fs.symlink(real, link, 'junction')
  } else {
    await fs.symlink(real, link)
  }
}
