// test/ have been moved to hardhat from truffle. The tests files expect a build/contract folder to work. This script moves relevant .json files from artifacts/contracts to build/contracts.

const path = require('path')
const fs = require('fs')

const copyJsonFilesToNewDir = (files, path) => {
    for (const file of files) {
        const currentPath = `${path}/${file}`

        if (fs.lstatSync(currentPath).isDirectory()) {
            // recurse when dir
            const folderFiles = fs.readdirSync(currentPath)
            copyJsonFilesToNewDir(folderFiles, currentPath)
        } else if (file.includes('.json')) {
            if (file.includes('.dbg.json')) {
                continue // skip .dbg.json files
            } else {
                fs.copyFile(
                    `${path}/${file}`,
                    `build/contracts/${file}`,
                    (err) => {
                        if (err) throw err
                    }
                )
            }
        }
    }
}

const transferToBuildFolder = (artifactsPath) => {
    const dirPath = path.join(__dirname, artifactsPath)

    const folders = fs.readdirSync(dirPath)

    if (!fs.existsSync(path.join(__dirname, '../build/contracts'))) {
        fs.mkdirSync(path.join(__dirname, '../build'))
        fs.mkdirSync(path.join(__dirname, '../build/contracts'))
    }

    copyJsonFilesToNewDir(folders, dirPath)
}

function main() {
    transferToBuildFolder('../artifacts/contracts')
    transferToBuildFolder('../artifacts/@pie-dao')
    transferToBuildFolder('../artifacts/@pangolindex')
}

main()
