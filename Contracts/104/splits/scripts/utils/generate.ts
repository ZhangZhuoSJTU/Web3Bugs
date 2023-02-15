const fs = require('fs');

const defaultArtifactsPath = "../../artifacts/contracts";
const defaultWritePath = "../../networks";

/**
 * Format contract info data
 * @param {*} contract contract name
 * @param {*} address newly deployed contract address
 * @param {*} path compiled contract path
 * @returns formated contract info
 */
const formatContract = (contract, address, path = defaultArtifactsPath) => {
    const dir = `${__dirname}/${path}`;

    try {
        const json = fs.readFileSync(`${dir}/${contract}.sol/${contract}.json`);
        const data = JSON.parse(json);

        return {
            [contract]: {
                address,
                abi: data.abi,
            },
        };
    } catch (error) {
        console.error(error);
        return {};
    }
};

/**
 * Write contract addresses and abis to /networks directory
 * @param {string | number} chainId network id
 * @param {*} content file content
 * @param {string} path file path
 */
const writeToJson = (chainId, content, path = defaultWritePath) => {
    const dir = `${__dirname}/${path}`;

    try {
        const json = JSON.stringify(content, null, 2);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
    
        fs.writeFileSync(`${dir}/${chainId}.json`, json);

        console.log('Done');
    } catch (error) {
        console.error(error);
    }
};

module.exports = {
    formatContract,
    writeToJson,
};
