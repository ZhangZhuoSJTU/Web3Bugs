/* Script for processing logged gas outputs from tests. 

Gas profiling logs the 'gas left', which includes the cost of the previous console.log call in the .sol file. 

A Hardhat console.log call of the form:
    
console.log("01. gas left: %s", gasleft());

costs ~1900 gas in Solidity.

This script converts gas left to gas used per step, accounting for and removing the logging gas costs. */

const fs = require('fs')

data = fs.readFileSync('./gasTest/outputs/gasTestOutput.txt', 'utf8').split('\n')

// Grab the step numbers and gas left at each step
const gasUsed = []

for (line of data) {
  if (line.includes("gas left:")) {
    
    const newLine = line.slice(0, 4) + line.slice(14).trim()
    gasUsed.push(newLine)
  }
}

console.log("Logged gas data is")
console.dir(gasUsed)

// Convert 'gas left' at each step to to 'gas used' by each step
processedData = []
totalGas = 0
for (i = 0; i < gasUsed.length; i++) {
  line = gasUsed[i]
  prevLine = gasUsed[i-1]

  const step = line.slice(0,3)
  if (step === "00.") {
    continue
  }
  const gas = Number(prevLine.slice(4)) - Number(line.slice(4)) - 1900
  processedData.push(`Gas used at step ${step}: ${gas} \n`)
  totalGas += gas
}

console.log("Processed gas data is")
console.log(processedData)
console.log(`Total gas usage of all steps is ${totalGas}`)

fs.writeFile('./gasTest/outputs/gasTestOutput.txt', processedData, (err) => {
  if (err) { console.log(err) }
})
