const Mutation = require('../mutation')

function NumberIncreaseMutator() { }

NumberIncreaseMutator.prototype.name = 'number-increase'

NumberIncreaseMutator.prototype.getMutations = function (file, source, visit) {
  const mutations = []

  visit({
    NumberLiteral: (node) => {
    
      if (node.subdenomination) {
        return // TODO(federicobond) add support for numbers with subdenomination
      }

      if (node.number === '1e18') {
        mutations.push(new Mutation(file, node.range[0], node.range[1] + 1, '1e19'))
      } else {
        let num = parseInt(node.number)
        num = isNaN(num) ? '1' : (num + 1).toString()
        mutations.push(new Mutation(file, node.range[0], node.range[1] + 1, num))
      }
    }
  })
  return mutations
}

module.exports = NumberIncreaseMutator