import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function run(command, args, { cwd = repoRoot } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env
    })

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) return resolve()

      const suffix = signal ? ` (signal: ${signal})` : ''
      reject(new Error(`[docs:api] Command failed (${code ?? 'null'})${suffix}: ${command} ${args.join(' ')}`))
    })
  })
}

async function main() {
  // TypeDoc builds a TypeScript program for the entrypoint package.
  // This repo's packages import each other via package exports that point at
  // `dist/**`, so we need declarations emitted for internal deps first.
  await run(pnpmBin, ['-C', 'packages/backend-contract', 'exec', 'tsc', '-p', 'tsconfig.json', '--emitDeclarationOnly'])
  await run(pnpmBin, ['-C', 'packages/core', 'exec', 'tsc', '-p', 'tsconfig.json', '--emitDeclarationOnly'])
  await run(pnpmBin, ['-C', 'packages/backend-wasm', 'exec', 'tsc', '-p', 'tsconfig.json', '--emitDeclarationOnly'])
  await run(pnpmBin, ['-C', 'packages/tspice', 'exec', 'tsc', '-p', 'tsconfig.json', '--emitDeclarationOnly'])

  await run(pnpmBin, ['-C', 'apps/docs', 'exec', 'typedoc', '--options', 'typedoc/tspice.json'])
  await run(pnpmBin, ['-C', 'apps/docs', 'exec', 'typedoc', '--options', 'typedoc/backend-contract.json'])
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
