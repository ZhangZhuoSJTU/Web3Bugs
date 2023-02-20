const childProcess = require('child_process')
const copy = require('recursive-copy')
const fs = require('fs')
const glob = require('glob')
const mkdirp = require('mkdirp')
const parser = require('solidity-parser-antlr')
const mutators = require('./mutators')
const config = require('./config')
const Reporter = require('./reporter')

const baselineDir = config.baselineDir
const contractsDir = config.contractsDir
const defaultContractsGlob = config.defaultContractsGlob

function prepare(callback) {
  mkdirp(baselineDir, () =>
    copy(contractsDir, baselineDir, { dot: true }, callback)
  )
}

function generateAllMutations(files) {
  let mutations = []

  const mutator = new mutators.CompositeMutator([
    new mutators.ConditionalBoundaryMutator(),
    new mutators.ConditionalInversionMutator(),
    new mutators.BooleanMutator(),
    new mutators.NumberIncreaseMutator(),
    new mutators.NumberDecreaseMutator(),
  ])

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    const ast = parser.parse(source, { range: true })

    const visit = parser.visit.bind(parser, ast)

    mutations = mutations.concat(mutator.getMutations(file, source, visit))
  }

  return mutations
}

function runTests(mutation, testFilePaths) {
  const args = ['test'].concat(testFilePaths)
  console.log("args are:")
  for (const arg of args) { console.log(arg)}
  const proc = childProcess.spawnSync('npm.cmd', args)
  return proc.status === 0
}

function test(argv) {
  const reporter = new Reporter()

  const contractsGlob = getContractsGlob()

  const testFilePaths = getTestFilePaths()

  prepare(() =>
    glob(contractsDir + contractsGlob, (err, files) => {
      if (err) {
        console.error(err)
        process.exit(1)
      }

      const mutations = generateAllMutations(files)

      for (const mutation of mutations) {
        mutation.apply()

        reporter.beginMutant(mutation)

        const result = runTests(mutation, testFilePaths)

        if (result) {
          reporter.mutantSurvived(mutation)
          if (argv.failfast) process.exit(1)
        } else {
          reporter.mutantKilled(mutation)
        }

        mutation.restore()
      }

      reporter.summary()
    })
  )
}

function preflight(argv) {

  const contractsGlob = getContractsGlob()

  prepare(() => {
    glob(contractsDir + contractsGlob, (err, files) => {
      const mutations = generateAllMutations(files)

      console.log(mutations.length + ' possible mutations found.')
      console.log('---')

      for (const mutation of mutations) {
        console.log(mutation.file + ':' + mutation.hash() + ':')
        process.stdout.write(mutation.diff())
      }
    })
  })

  getTestFilePaths()
}

function getContractsGlob() {
  const contractName = process.argv[3]
  let contractsGlob = "/"

  if (typeof contractName === "string" && contractName.length !== 0) {
    contractsGlob = contractsGlob.concat(contractName)
  } else {
    contractsGlob = contractsGlob.concat(defaultContractsGlob)
  }

  return contractsGlob
}

function getTestFilePaths() {
  const args = process.argv
  const paths = []
  for (i = 0; i < args.length; i++) {
    if (args[i].includes("Test") && args[i].includes(".js")) {
      const path = "./test/" + args[i]
      paths.push(path)
    }
  }
  console.log("paths are:")
  for (path of paths) { console.log(path) }
  return paths
}

module.exports = { test: test, preflight, preflight }
