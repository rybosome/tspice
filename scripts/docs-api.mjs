import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function binPath(name) {
  const ext = process.platform === 'win32' ? '.cmd' : ''
  return path.join(repoRoot, 'apps', 'docs', 'node_modules', '.bin', `${name}${ext}`)
}

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
  const typedocBin = binPath('typedoc')
  if (!fs.existsSync(typedocBin)) {
    throw new Error(
      `[docs:api] Missing ${typedocBin}. Did you run \`pnpm install\` (including @rybosome/docs)?`
    )
  }

  // TypeDoc builds a TypeScript program for the entrypoint package.
  // This repo's packages import each other via package exports that point at
  // `dist/**`, so we need declarations emitted for internal deps first.
  await run('pnpm', ['-C', 'packages/backend-contract', 'exec', 'tsc', '-p', 'tsconfig.json', '--emitDeclarationOnly'])
  await run('pnpm', ['-C', 'packages/core', 'exec', 'tsc', '-p', 'tsconfig.json', '--emitDeclarationOnly'])
  await run('pnpm', ['-C', 'packages/backend-wasm', 'exec', 'tsc', '-p', 'tsconfig.json', '--emitDeclarationOnly'])

  await run(typedocBin, ['--options', 'apps/docs/typedoc/tspice.json'])
  await run(typedocBin, ['--options', 'apps/docs/typedoc/backend-contract.json'])
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
