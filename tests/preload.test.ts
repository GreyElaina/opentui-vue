import { describe, expect, it } from "bun:test"

describe("preload", () => {
  it("loads .vue files via @opentui/vue/preload", async () => {
    const child = Bun.spawn({
      cmd: ["bun", "--preload", "./scripts/preload.ts", "./tests/fixtures/preload-import.ts"],
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    })

    const stdout = await new Response(child.stdout).text()
    const stderr = await new Response(child.stderr).text()
    const exitCode = await child.exited

    expect(exitCode).toBe(0)
    expect(stdout).toContain("ok:true")
    expect(stderr.trim()).toBe("")
  })
})
