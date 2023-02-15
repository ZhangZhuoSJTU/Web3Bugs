import runSolidityTest from "./helpers/runSolidityTest"

runSolidityTest("TestEarningsPool", ["AssertUint"])
runSolidityTest("TestEarningsPool2", ["AssertUint", "AssertBool"])
runSolidityTest("TestEarningsPoolNoTranscoderRewardFeePool", [
    "AssertUint",
    "AssertBool"
])
runSolidityTest("TestEarningsPoolLIP36", ["AssertUint"])
