import fs from 'fs'
import path from 'path'
import { AbiCoder } from '@ethersproject/abi'
import { task } from 'hardhat/config'

const basePath = 'src/Facets/'
const libraryBasePath = 'src/Libraries/'

task(
  'diamondABI',
  'Generates ABI file for diamond, includes all ABIs of facets'
).setAction(async () => {
  let files = fs.readdirSync(__dirname + '/../' + basePath)
  const abi: AbiCoder[] = []
  for (const file of files) {
    const jsonFile = file.replace('sol', 'json')
    const data = fs.readFileSync(
      path.resolve(__dirname, `../artifacts/${basePath}${file}/${jsonFile}`)
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = JSON.parse(data.toString())
    abi.push(...json.abi)
  }
  files = fs.readdirSync(__dirname + '/../' + libraryBasePath)
  for (const file of files) {
    const jsonFile = file.replace('sol', 'json')
    if (jsonFile === 'LibStorage.json') {
      continue
    }
    const data = fs.readFileSync(
      path.resolve(
        __dirname,
        `../artifacts/${libraryBasePath}${file}/${jsonFile}`
      )
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = JSON.parse(data.toString())
    abi.push(...json.abi)
  }
  // files = fs.readdirSync('.' + sharedLibraryBasePath)
  // for (const file of files) {
  //   const jsonFile = file.replace('sol', 'json')
  //   let json = fs.readFileSync(
  //     `./artifacts/${sharedLibraryBasePath}${file}/${jsonFile}`
  //   )
  //   json = JSON.parse(json)
  //   abi.push(...json.abi)
  // }
  const finalAbi = JSON.stringify(abi)
  fs.writeFileSync('./diamondABI/diamond.json', finalAbi)
  console.log('ABI written to diamondABI/diamond.json')
})
