const Mutation = require('../mutation')

function NumberDecreaseMutator() { }

NumberDecreaseMutator.prototype.name = 'number-decrease'

NumberDecreaseMutator.prototype.getMutations = function (file, source, visit) {
  const mutations = []

  visit({
    NumberLiteral: (node) => {
    
      if (node.number === '1e18') {
        mutations.push(new Mutation(file, node.range[0], node.range[1] + 1, '1e17'))
      } else {
        let num = parseInt(node.number)
        num = isNaN(num) ? '0' : (num - 1).toString()
        mutations.push(new Mutation(file, node.range[0], node.range[1] + 1, num))
      }
    }
  })
  return mutations
}

module.exports = NumberDecreaseMutator