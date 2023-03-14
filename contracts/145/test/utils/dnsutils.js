const SignedSet = require('@ensdomains/dnsprovejs').SignedSet

function hexEncodeSignedSet(keys) {
    const ss = new SignedSet(keys.rrs, keys.sig)
    return [ss.toWire(), ss.signature.data.signature]
}

function hexEncodeName(name) {
    return '0x' + packet.name.encode(name).toString('hex')
}

function rootKeys(expiration, inception) {
    var name = '.'
    var sig = {
      name: '.',
      type: 'RRSIG',
      ttl: 0,
      class: 'IN',
      flush: false,
      data: {
        typeCovered: 'DNSKEY',
        algorithm: 253,
        labels: 0,
        originalTTL: 3600,
        expiration,
        inception,
        keyTag: 1278,
        signersName: '.',
        signature: new Buffer([]),
      },
    }

    var rrs = [
      {
        name: '.',
        type: 'DNSKEY',
        class: 'IN',
        ttl: 3600,
        data: { flags: 0, algorithm: 253, key: Buffer.from('0000', 'HEX') },
      },
      {
        name: '.',
        type: 'DNSKEY',
        class: 'IN',
        ttl: 3600,
        data: { flags: 0, algorithm: 253, key: Buffer.from('1112', 'HEX') },
      },
      {
        name: '.',
        type: 'DNSKEY',
        class: 'IN',
        ttl: 3600,
        data: {
          flags: 0x0101,
          algorithm: 253,
          key: Buffer.from('0000', 'HEX'),
        },
      },
    ]
    return { name, sig, rrs }
}

module.exports = { hexEncodeName, hexEncodeSignedSet, rootKeys }
