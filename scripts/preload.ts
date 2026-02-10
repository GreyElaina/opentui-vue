import { plugin, type BunPlugin } from "bun"
import { pluginVue3 } from "bun-plugin-vue3"

interface RuntimeBuildLike {
  config?: {
    define?: Record<string, string>
  }
  onResolve: (options: Record<string, unknown>, callback: (args: Record<string, unknown>) => unknown) => void
  onLoad: (options: Record<string, unknown>, callback: (args: Record<string, unknown>) => unknown) => void
}

const runtimeSafeVuePlugin = (): BunPlugin => {
  const basePlugin = pluginVue3()

  return {
    name: "@opentui/vue/preload",
    setup(build) {
      const runtimeBuild = build as unknown as RuntimeBuildLike

      if (!runtimeBuild.config) {
        runtimeBuild.config = {}
      }
      if (!runtimeBuild.config.define) {
        runtimeBuild.config.define = {}
      }

      const originalOnResolve = runtimeBuild.onResolve.bind(runtimeBuild)

      runtimeBuild.onResolve = (options, callback) => {
        const filter = options.filter

        // bun-plugin-vue3 relies on onResolve in Bun.build, but runtime preload already
        // resolves .vue paths and query imports correctly. Keeping that resolver in runtime
        // causes Bun to skip onLoad hooks and treat .vue as file paths.
        if (filter instanceof RegExp && filter.source.includes("\\.vue")) {
          return
        }

        originalOnResolve(options, callback)
      }

      basePlugin.setup(build)
    },
  }
}

plugin(runtimeSafeVuePlugin())
