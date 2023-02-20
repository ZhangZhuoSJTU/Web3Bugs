const fixSig = sig => {
    // The recover() in ECDSA.sol from openzeppelin-solidity requires signatures to have a v-value that is 27/28
    // ETH clients that implement eth_sign will return a signature with a v-value that is 27/28 or 0/1 (geth returns 27/28 and ganache returns 0/1)
    // In order to support all ETH clients that implement eth_sign, we can fix the signature by ensuring that the v-value is 27/28
    let v = parseInt(sig.slice(130, 132), 16)
    if (v < 27) {
        v += 27
    }

    return sig.slice(0, 130) + v.toString(16)
}

export default async (msg, account) => {
    return fixSig(await web3.eth.sign(msg, account))
}
