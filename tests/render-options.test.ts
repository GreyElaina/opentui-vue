import { afterEach, describe, expect, it } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { defineComponent, h, inject, nextTick, type InjectionKey } from "vue"
import { render } from "../index"

describe("render options", () => {
  let testSetup: Awaited<ReturnType<typeof createTestRenderer>> | null = null

  afterEach(() => {
    if (testSetup) {
      testSetup.renderer.destroy()
      testSetup = null
    }
  })

  it("supports setupApp for app-level plugin/provider setup", async () => {
    const markerKey: InjectionKey<string> = Symbol("marker")
    let setupAppCalls = 0

    const AppComponent = defineComponent({
      setup() {
        const marker = inject(markerKey, "missing")
        return () => h("Text", { content: `marker:${marker}` })
      },
    })

    testSetup = await createTestRenderer({
      width: 30,
      height: 3,
      useThread: false,
    })

    await render(AppComponent, {
      renderer: testSetup.renderer,
      setupApp(app) {
        setupAppCalls += 1
        app.provide(markerKey, "enabled")
      },
    })

    await nextTick()
    await testSetup.renderOnce()

    const frame = testSetup.captureCharFrame()
    expect(frame).toContain("marker:enabled")
    expect(setupAppCalls).toBe(1)
  })

  it("keeps backward-compatible second argument behavior", async () => {
    const AppComponent = defineComponent({
      setup() {
        return () => h("Text", { content: "legacy-signature" })
      },
    })

    testSetup = await createTestRenderer({
      width: 30,
      height: 3,
      useThread: false,
    })

    await render(AppComponent, testSetup.renderer)

    await nextTick()
    await testSetup.renderOnce()

    const frame = testSetup.captureCharFrame()
    expect(frame).toContain("legacy-signature")
  })
})
