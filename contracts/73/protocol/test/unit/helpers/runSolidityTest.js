// Based on https://github.com/aragon/aragonOS/blob/4bbe3e96fc5a3aa6340b11ec67e6550029da7af9/test/helpers/runSolidityTest.js
import abi from "ethereumjs-abi"
import {ethers} from "hardhat"
import {eventSig} from "../../../utils/helpers"
import {assert} from "chai"
const HOOKS_MAP = {
    beforeAll: "before",
    beforeEach: "beforeEach",
    afterEach: "afterEach",
    afterAll: "afterAll"
}

const processResult = async txRes => {
    const receipt = await txRes.wait()
    const eventSignature = eventSig("TestEvent(bool,string)")
    const rawLogs = receipt.logs.filter(log => log.topics[0] === eventSignature)

    // Event defined in the libraries used by contracts/test/helpers/truffle/Assert.sol

    rawLogs.forEach(log => {
        const result = abi.rawDecode(
            ["bool"],
            Buffer.from(log.topics[1].slice(2), "hex")
        )[0]
        const message = abi.rawDecode(
            ["string"],
            Buffer.from(log.data.slice(2), "hex")
        )[0]

        if (!result) {
            assert.fail(message || "No assertions made")
        } else {
            assert.isOk(result)
        }
    })
}

/**
 * Runs a solidity test file, via javascript.
 * Required to smooth over some technical problems in solidity-coverage
 *
 * @param {string} c Name of Solidity test file
 * @param {Array} libs Array of names of Solidity libraries to link with test file
 * @param {Object} mochaContext Mocha context
 */
function runSolidityTest(c, libs, mochaContext) {
    describe(c, () => {
        const artifact = hre.artifacts.readArtifactSync(c)

        let deployed

        before(async () => {
            const libraries = {}
            for (const libName of libs) {
                libraries[libName] = (
                    await (await ethers.getContractFactory(libName)).deploy()
                ).address
            }

            const fac = await ethers.getContractFactory(c, {
                libraries: libraries
            })

            deployed = await fac.deploy()
        })

        mochaContext("> Solidity test", () => {
            artifact.abi.forEach(itf => {
                const name = itf.name

                if (itf.type === "function") {
                    if (
                        [
                            "beforeAll",
                            "beforeEach",
                            "afterEach",
                            "afterAll"
                        ].includes(itf.name)
                    ) {
                        // Set up hooks
                        global[HOOKS_MAP[name]](async () => {
                            const tx = await deployed[name]()
                            await processResult(tx)
                        })
                    } else if (itf.name.startsWith("test")) {
                        it(itf.name, async () => {
                            const tx = await deployed[name]()
                            await processResult(tx)
                        })
                    }
                }
            })
        })
    })
}

// Bind the functions for ease of use, and provide .only() and .skip() hooks
const fn = (c, libs) => runSolidityTest(c, libs, context)
fn.only = (c, libs) => runSolidityTest(c, libs, context.only)
fn.skip = (c, libs) => runSolidityTest(c, libs, context.skip)

module.exports = fn
