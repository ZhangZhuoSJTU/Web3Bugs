const chalk = require('chalk')

function Reporter() {
  this.survived = []
  this.killed = []
}

Reporter.prototype._formatMutant = function(mutant) {
  return chalk.green(mutant.hash())
}

Reporter.prototype.beginMutant = function(mutant) {
  const hash = mutant.hash()

  console.log('Applying mutation ' + hash + ' to ' + mutant.file)
  process.stdout.write(mutant.diff())
  console.log('Running tests for mutation ' + hash)
}

Reporter.prototype.mutantSurvived = function(mutant) {
  this.survived.push(mutant)
  console.log(' 👾 Mutant ' + this._formatMutant(mutant) + ' survived testing.')
}

Reporter.prototype.mutantKilled = function(mutant) {
  this.killed.push(mutant)
  console.log(
    ' 💪 Mutant ' + this._formatMutant(mutant) + ' was killed by tests.'
  )
}

Reporter.prototype.summary = function() {
  console.log(
    this.survived.length +
      ' mutants survived testing, ' +
      this.killed.length +
      ' mutants killed.'
  )
  console.log(
    'Survivors: ' + this.survived.map(m => this._formatMutant(m)).join(', ')
  )
}

module.exports = Reporter
