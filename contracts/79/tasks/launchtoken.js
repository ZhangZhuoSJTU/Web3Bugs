task("launch", "Deploy's an ERC20 token and creates a launch event")
  .addParam("issuer", "The launch events issuer address")
  .addParam("start", "Inix timestamp for auction start time")
  .addParam("amount", "The amount of token being aunctioned")
  .addParam("incentives", "Percentage of tokens as incentive")
  .addParam("floor", "The token floor price")
  .addParam(
    "maxpenalty",
    "The maximum of the variable withdraw penalty in phase 1"
  )
  .addParam("fixedpenalty", "The fixed withdraw penalty in phase 2")
  .addParam("maxallocation", "The maximum allocation per ethereum account")
  .addParam("usertimelock", "The users withdraw timelock")
  .addParam("issuertimelock", "The issuers withdraw timelock")
  .addParam("rocketfactoryaddress", "The address of rocket joe factory")
  .setAction(async (taskArgs) => {
    // Get deployer account.
    const accounts = await hre.ethers.getSigners();
    const dev = accounts[0];

    // Deploy new Mock ERC20 token.
    const ERC20TokenCF = await ethers.getContractFactory("ERC20Token");
    const token = await ERC20TokenCF.deploy();
    console.log(`Deployed token: ${token.address}`);

    // Send funds to msg.sender.
    await token.mint(dev.address, taskArgs.amount);
    console.log(`Minted ${taskArgs.amount} ${token.address} to ${dev.address}`);

    // Approve funds for rocket joe factory.
    await token.approve(taskArgs.rocketfactoryaddress, taskArgs.amount);
    console.log(`Approved ${taskArgs.rocketfactoryaddress} ${token.address}`);

    // Create launch event.
    const rocketFactory = await hre.ethers.getContractAt(
      "RocketJoeFactory",
      taskArgs.rocketfactoryaddress
    );
    await rocketFactory.createRJLaunchEvent(
      taskArgs.issuer,
      taskArgs.start,
      token.address,
      taskArgs.amount,
      taskArgs.incentives,
      taskArgs.floor,
      taskArgs.maxpenalty,
      taskArgs.fixedpenalty,
      taskArgs.maxallocation,
      taskArgs.usertimelock,
      taskArgs.issuertimelock
    );
    console.log(`Created launch event for ${token.address}`);
  });

module.exports = {};
