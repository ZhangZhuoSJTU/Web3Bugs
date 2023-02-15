const chalk = require('chalk')
const jsdiff = require('diff')
const fs = require('fs')
const sha1 = require('sha1')
const config = require('./config')

const baselineDir = config.baselineDir
const contractsDir = config.contractsDir

function splice(str, start, length, replacement) {
  return str.substring(0, start) + replacement + str.substring(start + length)
}

function Mutation(file, start, end, replace) {
  this.file = file
  this.start = start
  this.end = end
  this.replace = replace
}

Mutation.prototype.hash = function() {
  const input = [this.file, this.start, this.end, this.replace].join(':')
  return sha1(input).slice(0, 8)
}

Mutation.prototype.apply = function() {
  const original = fs.readFileSync(this.file, 'utf8')
  const mutated = this.applyToString(original)

  fs.writeFileSync(this.file, mutated, 'utf8')
}

Mutation.prototype.applyToString = function(original) {
  return splice(original, this.start, this.end - this.start, this.replace)
}

Mutation.prototype.restore = function() {
  const baseline = this.baseline()

  console.log('Restoring ' + this.file)

  const original = fs.readFileSync(baseline, 'utf8')
  fs.writeFileSync(this.file, original, 'utf8')
}

Mutation.prototype.baseline = function() {
  return baselineDir + this.file.substr(contractsDir.length)
}

Mutation.prototype.diff = function() {
  const original = fs.readFileSync(this.baseline(), 'utf8')
  const mutated = this.applyToString(original)

  const diff = jsdiff.diffLines(original, mutated)

  let out = ''

  diff.forEach(function(part) {
    // green for additions, red for deletions
    // grey for common parts
    const color = part.added ? 'green' : part.removed ? 'red' : 'grey'

    if (part.added || part.removed) out += chalk[color](part.value)
  })

  return out
}

Mutation.prototype.patch = function() {
  const original = fs.readFileSync(this.baseline(), 'utf8')
  const mutated = this.applyToString(original)

  return jsdiff.createPatch(this.file, original, mutated)
}

module.exports = Mutation
