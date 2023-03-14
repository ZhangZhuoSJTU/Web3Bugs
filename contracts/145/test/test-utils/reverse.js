const namehash = require('eth-ens-namehash')

function getReverseNode(addr) {
  return namehash.hash(addr.slice(2).toLowerCase() + '.addr.reverse')
}
module.exports = {
  getReverseNode,
}
