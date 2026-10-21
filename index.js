import fs from "fs"
import path from "path"
import Vips from "wasm-vips"
import { fileURLToPath } from "url"
import { extractImages } from "unpdf"
import * as pdfjsDist from "pdfjs-dist/legacy/build/pdf.mjs"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const wasmUrl = thisDir + "/node_modules/pdfjs-dist/wasm/"

const vips = await Vips()

function range(start, end, step = 1) {
  const result = []
  for (let i = start; i <= end; i += step) result.push(i)
  return result
}

function isPdfFile(data) {
  const magicNum = Array.from("%PDF-").map((char) => char.charCodeAt(0))
  for (let i = 0; i < magicNum.length; i++)
    if (data[i] !== magicNum[i]) return false
  return true
}

function isDirectory(path) {
  return fs.existsSync(path) && fs.lstatSync(path).isDirectory()
}

function isFile(path) {
  return fs.existsSync(path) && fs.lstatSync(path).isFile()
}

const pdfsDir = process.argv[2]
const imagesDir = process.argv[3]

if (!isDirectory(pdfsDir) && !isDirectory(imagesDir)) {
  console.error("Usage: node index.js <pdf-input-dir> <images-output-dir>")
  process.exit(1)
}

for (const pdfFile of fs.readdirSync(pdfsDir)) {
  const pdfFilePath = pdfsDir + "/" + pdfFile

  if (!isFile(pdfFilePath)) continue

  const data = new Uint8Array(fs.readFileSync(pdfFilePath))

  if (!isPdfFile(data)) continue

  const pdf = await pdfjsDist.getDocument({ data, wasmUrl }).promise

  const imagesByPages = await Promise.all(
    range(1, pdf.numPages).map((page) => extractImages(pdf, page)),
  )

  const images = imagesByPages.flat()

  let imageIndex = 1

  for (const image of images) {
    using vipsImage = vips.Image.newFromMemory(
      image.data,
      image.width,
      image.height,
      image.channels,
      "uchar",
    )

    const bytes = vipsImage.writeToBuffer(".png")

    const imageFile = path.parse(pdfFile).name + "#" + imageIndex + ".png"
    const imageFilePath = imagesDir + "/" + imageFile

    fs.writeFileSync(imageFilePath, Buffer.from(bytes))

    console.log("Saved image " + imageFilePath)

    imageIndex++
  }
}
