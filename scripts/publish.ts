import { $ } from 'bun'
import { resolve } from 'node:path'
import semver from 'semver'

info('Publishing packages')

const packages = await loadLocalPackages()
  .then(sortPackagesByDependencies)
  .then(compareRemotePackages)

for (const { name, pkg, published } of packages) {
  info(name, (published
    ? 'is already up to date'
    : `is being published (${pkg.version})`
  ))
}

for (const { name, path, pkg, published } of packages) {
  if (!published) {
    try {
      info('publishing', name, 'at', pkg.version)
      await $`cd ${path} && bun publish`.quiet()
      success(`${name}@${pkg.version}`)
    } catch(e: unknown) {
      error(e as Error)
    }
  }
}

// Helpers

function info(...chunks: string[]): void {
  console.log('🦋 ', 'info', ...chunks)
}

function success(...chunks: string[]): void {
  console.log('✅ ', 'success', ...chunks)
}

function error(error: Error): void {
  console.error('❌ ', 'error', error.message)
}

async function task<T>(callback: () => Promise<T>): Promise<T> {
  return callback()
}

async function loadLocalPackages(): Promise<PackageInfo[]> {
  const repoProc = $`bun turbo ls --filter='./packages/*' --output=json`
  const repo = JSON.parse(await repoProc.text())

  return Promise.all<PackageInfo>(
    repo.packages.items.map(({ name, path }: { name: string, path: string }) => {
      return task(async () => {
        const pkgFile = Bun.file(resolve(path, 'package.json'))
        const pkg = JSON.parse(await pkgFile.text())
        return { name, path, pkg, published: false }
      })
    })
  )
}

async function compareRemotePackages(pkgs: PackageInfo[]): Promise<PackageInfo[]> {
  return Promise.all<PackageInfo>(
    pkgs.map(pkgInfo => {
      info('npm info', pkgInfo.name)
      return task<PackageInfo>(async () => {
        try {
          const pkgProc = $`npm info ${pkgInfo.name} --json`
          const remotePkg = JSON.parse(await pkgProc.text())
          pkgInfo.published = semver.lte(pkgInfo.pkg.version, remotePkg.version)
        } catch(e) {
          pkgInfo.published = false
        }
        return pkgInfo
      })
    })
  )
}

function sortPackagesByDependencies(packages: PackageInfo[]): PackageInfo[] {
  // Create a map of package names to their full package objects
  const packageMap = new Map<string, PackageInfo>();
  packages.forEach(pkg => packageMap.set(pkg.name, pkg));

  // Create adjacency list representing dependencies
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Initialize graph and in-degree count
  packages.forEach(pkg => {
    graph.set(pkg.name, new Set());
    inDegree.set(pkg.name, 0);
  });

  // Build dependency graph
  packages.forEach(({ pkg }) => {
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {})
    };

    Object.keys(allDeps).forEach(dep => {
      // Only consider dependencies that are in our workspace
      if (packageMap.has(dep)) {
        graph.get(pkg.name)?.add(dep);
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      }
    });
  });

  // Kahn's algorithm for topological sort
  const result: PackageInfo[] = [];
  const queue: string[] = [];

  // Start with packages that have no dependencies
  inDegree.forEach((count, pkgName) => {
    if (count === 0) {
      queue.push(pkgName);
    }
  });

  while (queue.length > 0) {
    const pkgName = queue.shift()!;
    const pkg = packageMap.get(pkgName)!;
    result.push(pkg);

    // Remove this package from the graph and update in-degrees
    const deps = graph.get(pkgName) || new Set();
    deps.forEach(dep => {
      inDegree.set(dep, (inDegree.get(dep) || 0) - 1);
      if (inDegree.get(dep) === 0) {
        queue.push(dep);
      }
    });
  }

  // Check for circular dependencies
  if (result.length !== packages.length) {
    throw new Error('Circular dependency detected');
  }

  return result.reverse(); // Reverse to get dependencies before dependents
}

// Types

interface PackageInfo {
  name: string;
  path: string;
  pkg: PackageJson;
  published: boolean;
}

interface PackageJson {
  name: string;
  version: string;
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
}

// 🦋  info npm info @agentflow/cli
// 🦋  info npm info @agentflow/core
// 🦋  info npm info create-agentflow
// 🦋  info npm info @agentflow/tools
// 🦋  info @agentflow/cli is being published because our local version (0.2.4) has not been published on npm
// 🦋  info @agentflow/core is being published because our local version (0.2.4) has not been published on npm
// 🦋  info create-agentflow is being published because our local version (0.1.5) has not been published on npm
// 🦋  info @agentflow/tools is being published because our local version (0.1.5) has not been published on npm
// 🦋  info Publishing "@agentflow/cli" at "0.2.4"
// 🦋  info Publishing "@agentflow/core" at "0.2.4"
// 🦋  info Publishing "create-agentflow" at "0.1.5"
// 🦋  info Publishing "@agentflow/tools" at "0.1.5"
// 🦋  success packages published successfully:
// 🦋  @agentflow/cli@0.2.4
// 🦋  @agentflow/core@0.2.4
// 🦋  create-agentflow@0.1.5
// 🦋  @agentflow/tools@0.1.5
// 🦋  Creating git tags...
// 🦋  New tag:  @agentflow/cli@0.2.4
// 🦋  New tag:  @agentflow/core@0.2.4
// 🦋  New tag:  create-agentflow@0.1.5
// 🦋  New tag:  @agentflow/tools@0.1.5
