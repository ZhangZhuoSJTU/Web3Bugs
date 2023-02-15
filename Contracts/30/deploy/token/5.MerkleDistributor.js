module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const YAXIS = await deployments.get('YaxisToken');
    const MERKLE_ROOT = '0xbcb3e26fca3db7ebea6fc6796e2e4036ca5957c54d5ef684052197f024e945b9';

    await deploy('MerkleDistributor', {
        from: deployer,
        log: true,
        args: [YAXIS.address, MERKLE_ROOT]
    });
};

module.exports.tags = ['merkledrop'];
