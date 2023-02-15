import runSolidityTest from "./helpers/runSolidityTest"

runSolidityTest("TestSortedDoublyLLFindWithHints", [
    "SortedDoublyLL",
    "AssertAddress",
    "AssertUint"
])
runSolidityTest("TestSortedDoublyLLFindWithHints2", [
    "SortedDoublyLL",
    "AssertAddress",
    "AssertUint"
])
runSolidityTest("TestSortedDoublyLLInsert", [
    "SortedDoublyLL",
    "AssertAddress",
    "AssertUint",
    "AssertBool"
])
runSolidityTest("TestSortedDoublyLLRemove", [
    "SortedDoublyLL",
    "AssertAddress",
    "AssertUint",
    "AssertBool"
])
runSolidityTest("TestSortedDoublyLLUpdateKey", [
    "SortedDoublyLL",
    "AssertAddress",
    "AssertUint",
    "AssertBool"
])
