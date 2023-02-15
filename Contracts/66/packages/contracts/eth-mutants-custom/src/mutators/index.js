const ConditionalBoundaryMutator = require('./conditional-boundary')
const ConditionalInversionMutator = require('./conditional-inversion')
const NumberDecreaseMutator = require('./number-decrease')
const NumberIncreaseMutator = require('./number-increase')
const BooleanMutator = require('./boolean')

function CompositeMutator(mutators) {
  this.mutators = mutators
}

CompositeMutator.prototype.getMutations = function(file, source, visit) {
  let mutations = []
  for (const mutator of this.mutators) {
    mutations = mutations.concat(mutator.getMutations(file, source, visit))
  }
  return mutations
}

module.exports = {
  ConditionalBoundaryMutator: ConditionalBoundaryMutator,
  ConditionalInversionMutator: ConditionalInversionMutator,
  NumberDecreaseMutator: NumberDecreaseMutator,
  NumberIncreaseMutator: NumberIncreaseMutator,
  BooleanMutator: BooleanMutator,
  CompositeMutator: CompositeMutator
}
