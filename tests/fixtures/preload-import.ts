import PreloadSimple from "./PreloadSimple.vue"

const isAssetPath = typeof PreloadSimple === "string" && PreloadSimple.startsWith("file:")

console.log(`ok:${!isAssetPath}`)
