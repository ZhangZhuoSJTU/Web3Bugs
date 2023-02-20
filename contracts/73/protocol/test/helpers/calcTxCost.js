import {BigNumber} from "ethers"

export default async txRes => {
    const receipt = await txRes.wait()
    const tx = await web3.eth.getTransaction(txRes.hash)
    const gasPrice = BigNumber.from(tx.gasPrice)
    const gasUsed = BigNumber.from(receipt.cumulativeGasUsed.toString())
    return gasPrice.mul(gasUsed)
}
