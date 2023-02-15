const Mutation = require('../mutation')

function ConditionalInversionMutator() {}

ConditionalInversionMutator.prototype.name = 'conditional-inversion'

ConditionalInversionMutator.prototype.getMutations = function(file, source, visit) {
  const mutations = []

  visit({
    BinaryOperation: (node) => {
      const start = node.left.range[1] + 1
      const end = node.right.range[0]
      const text = source.slice(start, end)

      let replacement;
  
      if (node.operator === '<') {
        replacement = text.replace('<', '>')
      } else if (node.operator === '>') {
        replacement = text.replace('>', '<')
      } else if (node.operator === '<=') {
        replacement = text.replace('<=', '>=')
      } else if (node.operator === '>=') {
        replacement = text.replace('>=', '<=')
      } else if (node.operator === '==') {
        replacement = text.replace('==', '!=')
      } else if (node.operator === '!=') {
        replacement = text.replace('!=', '==')
      }

      if (replacement) {
        mutations.push(new Mutation(file, start, end, replacement))
      }
    },
  })

  return mutations
}

module.exports = ConditionalInversionMutator