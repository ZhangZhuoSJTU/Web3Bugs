const Mutation = require('../mutation')

function BooleanMutator() { }

BooleanMutator.prototype.name = 'boolean'

BooleanMutator.prototype.getMutations = function (file, source, visit) {
  const mutations = []

  visit({
    BooleanLiteral: (node) => {
      if (node.value) {
        mutations.push(new Mutation(file, node.range[0], node.range[1] + 1, 'false'))
      } else {
        mutations.push(new Mutation(file, node.range[0], node.range[1] + 1, 'true'))
      }
    }
  })
  return mutations
}

module.exports = BooleanMutator
