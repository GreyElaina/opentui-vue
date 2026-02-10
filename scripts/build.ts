import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"
import process from "process"

interface PackageJson {
  name: string
  version: string
  license?: string
  repository?: any
  description?: string
  homepage?: string
  author?: string
  bugs?: any
  keywords?: string[]
  module?: string
  main?: string
  types?: string
  type?: string
  exports?: any
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, "..")
const licensePath = join(rootDir, "LICENSE")
const packageJson: PackageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"))

const args = process.argv.slice(2)
const isDev = args.includes("--dev")

const replaceLinks = (text: string): string => {
  return packageJson.homepage
    ? text.replace(
        /(\[.*?\]\()(\.\/.*?\))/g,
        (_, p1: string, p2: string) => `${p1}${packageJson.homepage}/blob/HEAD/${p2.replace("./", "")}`,
      )
    : text
}

const requiredFields: (keyof PackageJson)[] = ["name", "version", "description"]
const missingRequired = requiredFields.filter((field) => !packageJson[field])
if (missingRequired.length > 0) {
  console.error(`Error: Missing required fields in package.json: ${missingRequired.join(", ")}`)
  process.exit(1)
}

console.log(`Building @opentui/vue library${isDev ? " (dev mode)" : ""}...`)

const distDir = join(rootDir, "dist")
rmSync(distDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })

const externalDeps: string[] = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.peerDependencies || {}),
]

if (!packageJson.module) {
  console.error("Error: 'module' field not found in package.json")
  process.exit(1)
}

const entryBuilds = [
  { label: "main entry point", entrypoint: join(rootDir, packageJson.module) },
  { label: "composables subpath", entrypoint: join(rootDir, "src/composables/index.ts") },
  { label: "components subpath", entrypoint: join(rootDir, "src/elements.ts") },
  { label: "devtools subpath", entrypoint: join(rootDir, "src/devtools/index.ts") },
  { label: "resolver subpath", entrypoint: join(rootDir, "src/resolver.ts") },
  { label: "preload subpath", entrypoint: join(rootDir, "scripts/preload.ts") },
] as const

for (const buildTarget of entryBuilds) {
  console.log(`Building ${buildTarget.label}...`)

  const result = await Bun.build({
    entrypoints: [buildTarget.entrypoint],
    target: "bun",
    outdir: distDir,
    root: rootDir,
    write: true,
    external: externalDeps,
  })

  if (!result.success) {
    console.error(`Build failed for ${buildTarget.label}:`, result.logs)
    process.exit(1)
  }
}

console.log("Generating TypeScript declarations...")

const tsconfigBuildPath = join(rootDir, "tsconfig.build.json")
const tsconfigBuild = {
  extends: "./tsconfig.json",
  compilerOptions: {
    declaration: true,
    emitDeclarationOnly: true,
    outDir: "./dist",
    noEmit: false,
    rootDir: ".",
    types: ["bun", "node"],
    skipLibCheck: true,
    jsx: "preserve",
    moduleResolution: "bundler",
  },
  include: ["index.ts", "src/**/*", "types/opentui.d.ts"],
  exclude: ["**/*.test.ts", "**/*.spec.ts", "example/**/*", "scripts/**/*", "node_modules/**/*"],
}

writeFileSync(tsconfigBuildPath, JSON.stringify(tsconfigBuild, null, 2))

const tscResult: SpawnSyncReturns<Buffer> = spawnSync("bunx", ["tsc", "-p", tsconfigBuildPath], {
  cwd: rootDir,
  stdio: "inherit",
})

rmSync(tsconfigBuildPath, { force: true })

if (tscResult.status !== 0) {
  console.warn("Warning: TypeScript declaration generation failed")
} else {
  console.log("TypeScript declarations generated")
}

// Manually copy the opentui.d.ts file
console.log("Copying custom declaration files...")
const typesDir = join(distDir, "types")
if (!existsSync(typesDir)) {
  mkdirSync(typesDir, { recursive: true })
}
copyFileSync(join(rootDir, "types/opentui.d.ts"), join(typesDir, "opentui.d.ts"))

const exports = {
  ".": {
    types: "./index.d.ts",
    import: "./index.js",
    require: "./index.js",
  },
  "./composables": {
    types: "./src/composables/index.d.ts",
    import: "./src/composables/index.js",
    require: "./src/composables/index.js",
  },
  "./components": {
    types: "./src/elements.d.ts",
    import: "./src/elements.js",
    require: "./src/elements.js",
  },
  "./devtools": {
    types: "./src/devtools/index.d.ts",
    import: "./src/devtools/index.js",
    require: "./src/devtools/index.js",
  },
  "./resolver": {
    types: "./src/resolver.d.ts",
    import: "./src/resolver.js",
    require: "./src/resolver.js",
  },
  "./preload": {
    import: "./scripts/preload.js",
    require: "./scripts/preload.js",
  },
}

const processedDependencies = { ...packageJson.dependencies }

writeFileSync(
  join(distDir, "package.json"),
  JSON.stringify(
    {
      name: packageJson.name,
      module: "index.js",
      main: "index.js",
      types: "index.d.ts",
      type: packageJson.type,
      version: packageJson.version,
      description: packageJson.description,
      keywords: packageJson.keywords,
      license: packageJson.license,
      author: packageJson.author,
      homepage: packageJson.homepage,
      repository: packageJson.repository,
      bugs: packageJson.bugs,
      exports,
      dependencies: processedDependencies,
      peerDependencies: packageJson.peerDependencies,
    },
    null,
    2,
  ),
)

const readmePath = join(rootDir, "README.md")
if (existsSync(readmePath)) {
  writeFileSync(join(distDir, "README.md"), replaceLinks(readFileSync(readmePath, "utf8")))
} else {
  console.warn("Warning: README.md not found in vue package")
}

if (existsSync(licensePath)) {
  copyFileSync(licensePath, join(distDir, "LICENSE"))
} else {
  console.warn("Warning: LICENSE file not found in project root")
}

console.log("Library built at:", distDir)
