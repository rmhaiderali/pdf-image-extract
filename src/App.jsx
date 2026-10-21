import JSZip from "jszip"
import Vips from "wasm-vips"
import { extractImages } from "unpdf"
import * as pdfjsDist from "pdfjs-dist"

import vipsWasmUrl from "/node_modules/wasm-vips/lib/vips.wasm?url"
import vipsJxlWasmUrl from "/node_modules/wasm-vips/lib/vips-jxl.wasm?url"
import vipsHeifWasmUrl from "/node_modules/wasm-vips/lib/vips-heif.wasm?url"
import vipsResvgWasmUrl from "/node_modules/wasm-vips/lib/vips-resvg.wasm?url"

import pdfjsWorker from "/node_modules/pdfjs-dist/build/pdf.worker.mjs?url"

pdfjsDist.GlobalWorkerOptions.workerSrc = pdfjsWorker

const files = {
  "vips.wasm": vipsWasmUrl,
  "vips-jxl.wasm": vipsJxlWasmUrl,
  "vips-heif.wasm": vipsHeifWasmUrl,
  "vips-resvg.wasm": vipsResvgWasmUrl,
}

const vips = await Vips({ locateFile: (file) => files[file] })

function range(start, end, step = 1) {
  const result = []
  for (let i = start; i <= end; i += step) result.push(i)
  return result
}

async function extractAllFormatsWithVips(file) {
  const pdf = await pdfjsDist.getDocument({
    wasmUrl: "pdfjs-dist/wasm/",
    data: await file.arrayBuffer(),
    isImageDecoderSupported: false, // get image.data instead of image.bitmap
    isOffscreenCanvasSupported: false, // get image.data instead of image.bitmap
  }).promise

  const imagesByPages = await Promise.all(
    range(1, pdf.numPages).map((page) => extractImages(pdf, page)),
  )

  const images = imagesByPages.flat()

  const zip = new JSZip()

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

    const fileName = imageIndex + ".png"

    zip.file(fileName, bytes)

    console.log("Added image " + fileName + " to zip")

    imageIndex++
  }

  return await zip.generateAsync({ type: "blob" })
}

function App() {
  return (
    <input
      type="file"
      accept="application/pdf"
      onChange={async (e) => {
        const files = Array.from(e.target.files)
        const file = files[0]

        if (file.type !== "application/pdf") {
          alert("Please select a PDF file")
          return
        }

        const zipBlob = await extractAllFormatsWithVips(file)

        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement("a")
        a.href = url
        a.download = file.name + "-extracted-images.zip"
        a.click()
        URL.revokeObjectURL(url)
      }}
    />
  )
}

export default App
