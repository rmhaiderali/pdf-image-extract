import fs from "fs"
import path from "path"
import { promisify } from "util"
import child_process from "child_process"

const exec = promisify(child_process.exec)

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
  console.error("Usage: node poppler.js <pdf-input-dir> <images-output-dir>")
  process.exit(1)
}

for (const pdfFile of fs.readdirSync(pdfsDir)) {
  const pdfFilePath = pdfsDir + "/" + pdfFile

  if (!isFile(pdfFilePath)) continue

  const data = new Uint8Array(fs.readFileSync(pdfFilePath))

  if (!isPdfFile(data)) continue

  const imageFile = path.parse(pdfFile).name
  const imageFilePath = imagesDir + "/" + imageFile

  const cmd = "pdfimages -all '" + pdfFilePath + "' '" + imageFilePath + "'"

  let result = {}

  try {
    result = await exec(cmd)
  } catch (e) {
    result = e
  }

  if (result.stderr) console.error(result.stderr)
  else console.log("Extracted images from " + pdfFilePath + " to " + imagesDir)
}
