// Renders the figures of compression-via-sparsity.qmd with the Compression
// Playground, so the article shows exactly what the playground computes and
// ships no transform code of its own.
//
//   npm run build && npx wrangler dev        # in another terminal
//   npm run export-compression-figures [-- playground URL]
//
// Drives the system Chrome (WebGPU needs a real GPU) through the playground's
// own inputs, reads its results from the OJS runtime, and writes into
// vault/articles/data/compression/:
//   *.webp        panels and crops the article shows; crops are lossless
//   curves.csv    energy discarded against fraction kept, per image and basis
//   stats.json    PSNR, energy and fraction kept at the article's 5% budget
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { chromium, type Page } from "playwright-core"

// ?pixel adds the identity basis to the playground's menu, for the baseline.
const url = process.argv[2] ?? "http://localhost:8787/articles/compression-playground.html?pixel"
const out = "vault/articles/data/compression"
const SIDE = 1024
// Full panels show at 340 CSS px at most, so 640 covers a 2x screen.
const MAX_SIDE = 640
const KEEP = 5
const BASES = ["Pixel", "Fourier", "DCT", "Wavelet: Haar", "Wavelet: Daubechies 4"]
// The cliff edge and the people on it: edges, texture and flat water, where the
// bases fail differently. Fractions of the side.
const CROP = { x: 0.39, y: 0.625, size: 0.25 }
// Error crops are |original - reconstruction| per channel times this. The
// playground's ×10 saturates most of the rock at a 5% budget, which hides the
// difference between bases.
const ERROR_GAIN = 4

const slug = (basis: string) => basis.replace("Wavelet: ", "").replace(" ", "").toLowerCase()

// Resolves once the playground has recomputed and drawn everything that the
// last input change touched.
async function settle(page: Page) {
  await page.evaluate(async () => {
    const frame = () => new Promise(requestAnimationFrame)
    await frame()
    await frame()
    const m = (window as any)._ojs.ojsConnector.mainModule
    await m.value("cut")
    const gpu = await m.value("gpu")
    await gpu.device.queue.onSubmittedWorkDone()
    await frame()
  })
}

async function set(page: Page, basis: string, keep: number) {
  await page.getByLabel("basis").selectOption({ label: basis })
  await page.locator(".keep-slider input").evaluate((el: HTMLInputElement, v) => {
    el.value = String(Math.log10(v))
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }, keep)
  await settle(page)
}

// A data URL's bytes.
const bytes = (url: string) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64")

// Save one panel, or the CROP region of it, as WebP, at most MAX_SIDE wide.
// Crops are lossless: their artifacts are what the article compares, and lossy
// WebP adds its own and subsamples colour. Chrome encodes quality 1 losslessly.
async function save(page: Page, panel: string, file: string, crop = false) {
  const url = await page.evaluate(async ([panel, crop, box, max]) => {
    const src = (await (window as any)._ojs.ojsConnector.mainModule.value("canvases"))[panel]
    const [x, y, w, h] = crop
      ? [box.x * src.width, box.y * src.height, box.size * src.width, box.size * src.width].map(Math.round)
      : [0, 0, src.width, src.height]
    const scale = Math.min(1, max / w)
    const c = document.createElement("canvas")
    c.width = Math.round(w * scale)
    c.height = Math.round(h * scale)
    const ctx = c.getContext("2d")!
    ctx.imageSmoothingQuality = "high"
    // Same task as the redraw, or a WebGPU canvas reads back empty.
    src.redraw()
    ctx.drawImage(src, x, y, w, h, 0, 0, c.width, c.height)
    return c.toDataURL("image/webp", crop ? 1 : 0.85)
  }, [panel, crop, CROP, MAX_SIDE] as const)
  const data = bytes(url)
  writeFileSync(`${out}/${file}.webp`, data)
  console.log(`${file}.webp  ${(data.length / 1024).toFixed(0)} KB`)
}

// Save |original - reconstruction| × ERROR_GAIN over the CROP region, losslessly.
async function saveError(page: Page, file: string) {
  const url = await page.evaluate(async ([box, gain]) => {
    const canvases = await (window as any)._ojs.ojsConnector.mainModule.value("canvases")
    const read = (src: any) => {
      const [x, y, s] = [box.x * src.width, box.y * src.height, box.size * src.width].map(Math.round)
      const c = Object.assign(document.createElement("canvas"), { width: s, height: s })
      const ctx = c.getContext("2d")!
      // Same task as the redraw, or a WebGPU canvas reads back empty.
      src.redraw()
      ctx.drawImage(src, x, y, s, s, 0, 0, s, s)
      return { c, ctx, data: ctx.getImageData(0, 0, s, s) }
    }
    const a = read(canvases.original), b = read(canvases.reconstruction)
    const d = a.data.data, e = b.data.data
    for (let i = 0; i < d.length; i++) d[i] = i % 4 === 3 ? 255 : Math.min(255, gain * Math.abs(d[i] - e[i]))
    a.ctx.putImageData(a.data, 0, 0)
    return a.c.toDataURL("image/webp", 1)
  }, [CROP, ERROR_GAIN] as const)
  const data = bytes(url)
  writeFileSync(`${out}/${file}.webp`, data)
  console.log(`${file}.webp  ${(data.length / 1024).toFixed(0)} KB`)
}

async function stats(page: Page) {
  return page.evaluate(async () => {
    const m = (window as any)._ojs.ojsConnector.mainModule
    const { n, curve } = await m.value("analysis")
    const { energy, psnr, kept } = await m.value("cut")
    // Every 5% of rank is plenty for a log-axis plot.
    const points = []
    for (const d of curve) {
      if (!points.length || d.rank >= points.at(-1).rank * 1.05) points.push(d)
    }
    return { energy, psnr, kept: kept / n, curve: points.map((d: any) => ({ fraction: d.rank / n, discarded: 1 - d.energy })) }
  })
}

// Seeded white noise, SIDE x SIDE, as a lossless PNG: the signal no basis
// compresses. Generated in the page so the bytes need no encoder here.
async function noisePng(page: Page) {
  const url = await page.evaluate((n) => {
    const c = document.createElement("canvas")
    c.width = c.height = n
    const ctx = c.getContext("2d")!
    const img = ctx.createImageData(n, n)
    let s = 2463534242
    for (let i = 0; i < img.data.length; i++) {
      s ^= s << 13; s >>>= 0
      s ^= s >>> 17
      s ^= s << 5; s >>>= 0
      img.data[i] = i % 4 === 3 ? 255 : s >>> 24
    }
    ctx.putImageData(img, 0, 0)
    return c.toDataURL("image/png")
  }, SIDE)
  return bytes(url)
}

mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--enable-unsafe-webgpu"] })
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
// A page error can leave a panel blank, so flag the run as failed.
page.on("pageerror", (e) => {
  console.error("page:", e.message)
  process.exitCode = 1
})
await page.goto(url)
await page.getByRole("radio", { name: SIDE.toLocaleString("en-US"), exact: true }).check()

const images = {
  fjord: { mimeType: "image/jpeg", buffer: readFileSync("vault/articles/data/fjord-2048.jpg") },
  noise: { mimeType: "image/png", buffer: await noisePng(page) },
}
const rows = ["image,basis,fraction,discarded"]
const summary: Record<string, object> = {}

for (const [image, file] of Object.entries(images)) {
  await page.locator("input[type=file]").setInputFiles({ name: image, ...file })
  await settle(page)
  for (const basis of BASES) {
    await set(page, basis, KEEP)
    const { curve, ...s } = await stats(page)
    summary[`${image}/${basis}`] = s
    for (const d of curve) rows.push(`${image},${basis},${d.fraction.toPrecision(4)},${d.discarded.toPrecision(4)}`)
  }

  await set(page, "DCT", KEEP)
  await save(page, "original", image)
  await save(page, "coefficients", `${image}-dct-coefficients`)
  if (image !== "fjord") continue
  await save(page, "sparse", "fjord-dct-sparse")
  await save(page, "reconstruction", "fjord-dct")
  await set(page, "Pixel", KEEP)
  await save(page, "reconstruction", "fjord-pixel")
  for (const basis of BASES.slice(1)) {
    await set(page, basis, KEEP)
    await save(page, "reconstruction", `crop-${slug(basis)}`, true)
    await saveError(page, `crop-${slug(basis)}-error`)
  }
  await save(page, "original", "crop-original", true)
}

writeFileSync(`${out}/curves.csv`, rows.join("\n") + "\n")
writeFileSync(`${out}/stats.json`, JSON.stringify(summary, null, 2) + "\n")
console.log(JSON.stringify(summary, null, 2))
await browser.close()
