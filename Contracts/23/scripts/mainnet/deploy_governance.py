import json
import os

from brownie import accounts, network
from brownie.convert.datatypes import Wei
from scripts.deployment import deployArtifact, deployGovernance, deployNoteERC20

EnvironmentConfig = {
    "development": {
        "AirdropClaimTime": 0,
        "NotionalFoundation": "0x57903069f1406808e83018b498de7fa2E54f451f",
        "GuardianMultisig": "0x628029b5b7574296365EEF243f240aF83ffA7111",
    },
    "kovan": {
        "AirdropClaimTime": 1629097200,  # August 16, 2021 UTC 0
        "NotionalFoundation": "0x4ba1d028e053A53842Ce31b0357C5864B40Ef909",
        "GuardianMultisig": "0x6F7F94E4fdC3eDa4693d8FC5da94014B11572B3F",
    },
    "mainnet": {},
}

GovernanceConfig = {
    "initialBalances": {
        "GovernorAlpha": Wei(50_000_000e8),
        "Airdrop": Wei(749_990e8),
        "NotionalFoundation": Wei(49_250_010e8),
    },
    # Governance config values will favor shorter voting windows initially and then
    # can be updated to have longer voting windows as governance gets more mature
    "governorConfig": {
        "quorumVotes": Wei(4_000_000e8),  # 4% of total supply
        "proposalThreshold": Wei(1_000_000e8),  # 1% of total supply
        "votingDelayBlocks": 1,  # ~13 seconds
        "votingPeriodBlocks": 13292,  # ~2 days
        "minDelay": 43200,  # 12 hours in seconds
    },
}


def deployAirdropContract(deployer, token, networkName):
    AirdropMerkleTree = json.load(
        open(os.path.join(os.path.dirname(__file__), "AirdropMerkleTree.json"), "r")
    )

    airdrop = deployArtifact(
        os.path.join(os.path.dirname(__file__), "MerkleDistributor.json"),
        [
            token.address,
            AirdropMerkleTree["merkleRoot"],
            EnvironmentConfig[networkName]["AirdropClaimTime"],
        ],
        deployer,
        "AirdropContract",
    )
    print("Deployed airdrop contract to {}".format(airdrop.address))

    return airdrop


def main():
    # Load the deployment address
    deployer = accounts.load(network.show_active().upper() + "_DEPLOYER")
    startBlock = network.chain.height
    networkName = network.show_active()
    if networkName == "development":
        accounts[0].transfer(deployer, 100e18)

    print("Loaded deployment account at {}".format(deployer.address))
    print("Deploying to {}".format(network.show_active()))

    # Deploying NOTE token
    (noteERC20Proxy, noteERC20) = deployNoteERC20(deployer)
    print("Deployed NOTE token to {}".format(noteERC20.address))

    # Deploying airdrop contract
    airdrop = deployAirdropContract(deployer, noteERC20, networkName)

    # Deploying governance
    governor = deployGovernance(
        deployer,
        noteERC20,
        EnvironmentConfig[networkName]["GuardianMultisig"],
        GovernanceConfig["governorConfig"],
    )
    print("Deployed Governor to {}".format(governor.address))

    # Initialize NOTE token balances
    initialAddresses = [
        governor.address,
        airdrop.address,
        EnvironmentConfig[networkName]["NotionalFoundation"],
    ]
    initialBalances = [
        GovernanceConfig["initialBalances"]["GovernorAlpha"],
        GovernanceConfig["initialBalances"]["Airdrop"],
        GovernanceConfig["initialBalances"]["NotionalFoundation"],
    ]

    txn = noteERC20.initialize(
        initialAddresses,
        initialBalances,
        # The owner of the token will be set to the multisig initially
        EnvironmentConfig[networkName]["GuardianMultisig"],
        {"from": deployer},
    )
    print("NOTE token initialized with balances to accounts:")
    for t in txn.events["Transfer"]:
        print(
            "from: {}, to: {}, formatted amount: {}".format(
                t["from"], t["to"], (t["amount"] / 10 ** 8)
            )
        )

        assert noteERC20.balanceOf(t["to"]) == t["amount"]

    print("Current NOTE token owner is {}".format(noteERC20.owner()))

    # Save outputs here
    output_file = "v2.{}.json".format(network.show_active())
    with open(output_file, "w") as f:
        json.dump(
            {
                "chainId": network.chain.id,
                "networkName": network.show_active(),
                "airdrop": airdrop.address,
                "deployer": deployer.address,
                "guardian": EnvironmentConfig[networkName]["GuardianMultisig"],
                "governor": governor.address,
                "note": noteERC20.address,
                "startBlock": startBlock,
            },
            f,
            sort_keys=True,
            indent=4,
        )


# Total Gas Used:
# NoteERC20 Implementation: 2,302,762
# nProxy Deployment: 279,996
# Airdrop Contract: 404,638
# GovernorAlpha Contract: 4,028,419
# Initialize ERC20: 152,218

# To Verify Sources via Hardhat:
# NoteERC20 Impl:
# npx hardhat verify --network kovan 0x90c3c405716B8fF965dc905C91eee82A0b41A4fF
# TODO: nProxy verifies via brownie but not hardhat :(
# nProxy:
# npx hardhat verify --constructor-args scripts/mainnet/note-proxy-args.js \
# --network kovan 0xCFEAead4947f0705A14ec42aC3D44129E1Ef3eD5
# GovernorAlpha:
# npx hardhat verify --constructor-args scripts/mainnet/governor-args.js \
# --network kovan 0x72Ec9dE3eFD22552b6dc17142EAd505A48940D4E
