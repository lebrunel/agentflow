import fs from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { confirm, input } from '@inquirer/prompts'
import minimist from 'minimist'
import pc from 'picocolors'

const defaultDir = 'agentflow-project'
const defaultTmp = 'default'

async function setup(cwd: string, argv: minimist.ParsedArgs): Promise<void> {
  const argDir = argv._[0]?.trim()
  const templateDir = resolve(__dirname, '..', 'templates', argv.template)

  if (!fs.existsSync(templateDir)) {
    console.error(pc.red('✖') + ` Template not found: ${argv.template}`)
    return
  }

  let projectName: string
  let targetDir: string
  let overWrite: boolean

  try {
    projectName = await input({
      message: 'Project name:',
      default: argDir && argDir !== '.' ? argDir : defaultDir,
      required: true,
      validate(name) {
        if (!/^[a-z0-9_\-]+$/.test(name)) {
          return 'Project name can consist of lowercase letters, numbers, underscore and dashes only.'
        }
        return true
      }
    })

    targetDir = join(cwd, argDir || projectName)

    if (fs.existsSync(targetDir)) {
      overWrite = await confirm({
        message: `${
          targetDir === '.' ? 'Current directory' : 'Target directory'
        } is not empty. Remove existing files and continue?`,
        default: false,
      })

      if (!overWrite) {
        throw new Error(`${pc.red('✖')} Operation cancelled`)
      }
    }
  } catch(e: unknown) {
    console.error((e as Error).message)
    return
  }

  console.log(`\nScaffolding project in: ${pc.bold(targetDir)}`)

  createDir(targetDir, overWrite!)
  copyDir(templateDir, targetDir, ['package.json'])
  createPackage(templateDir, targetDir, projectName!)

  const [pkgManager] = process.env.npm_config_user_agent
    ? process.env.npm_config_user_agent.split(' ')[0].split('/')
    : ['npm']

  console.log(`\nDone. Now run:\n`)
  if (targetDir !== cwd) {
    console.log(`  ${pc.dim('❯')} cd ${relative(cwd, targetDir)}`)
  }
  console.log(`  ${pc.dim('❯')} ${pkgManager === 'yarn' ? 'yarn' : `${ pkgManager } i`}`)
  console.log()
}

// Map src names to target names
const renameFiles: Record<string, string> = {
  _env: '.env',
  _gitignore: '.gitignore',
}

function createDir(dir: string, overWrite?: boolean) {
  const dirExists = fs.existsSync(dir)
  if (dirExists && overWrite) {
    for (const file of fs.readdirSync(dir)) {
      if (file === '.git') continue
      fs.rmSync(resolve(dir, file), { recursive: true, force: true })
    }
  } else if (!dirExists) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function copyDir(src: string, dest: string, exclude: string[] = []): void {
  createDir(dest)
  const files = fs.readdirSync(src)
  for (const file of files.filter((f) => !exclude.includes(f))) {
    const name = renameFiles[file] ?? file
    copyFile(join(src, file), join(dest, name))
  }
}

function copyFile(src: string, dest: string): void {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    fs.copyFileSync(src, dest)
  }
}

function createPackage(src: string, dest: string, projectName: string) {
  const pkg = JSON.parse(fs.readFileSync(join(src, 'package.json'), 'utf-8'))
  pkg.name = projectName
  fs.writeFileSync(join(dest, 'package.json'), JSON.stringify(pkg, null, 2))
}

const argv = minimist(process.argv.slice(2), {
  string: ['_'],
  alias:    { template: 't' },
  default:  { template: defaultTmp },
})

setup(process.cwd(), argv).catch((e) => {
  console.error(e)
})
