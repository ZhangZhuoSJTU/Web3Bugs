async function deployZap() {

    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    // const [TransparentUpgradeableProxy, Zap] = await Promise.all([
    //     ethers.getContractFactory('TransparentUpgradeableProxy'),
    //     ethers.getContractFactory('Zap')
    // ])
    const zapImpl = await Zap.deploy()

    console.log({ zapImpl: zapImpl.address })

    // const zapImpl = await ethers.getContractAt('Zap', '0x4459A591c61CABd905EAb8486Bf628432b15C8b1')
    // const args = [
    //     zapImpl.address,
    //     '0xBf0e27fdf5eF7519A9540DF401cCe0A7a4Cd75Bc', // proxyAdmin
    //     zapImpl.interface.encodeFunctionData('init', ['0xCF7346A5E41b0821b80D5B3fdc385EEB6Dc59F44' /* ibbtc Metasig */])
    // ]

    // console.log(args)
    // const zap = await TransparentUpgradeableProxy.deploy(...args)
    // console.log({ zap: zap.address })

}

deployZap()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
