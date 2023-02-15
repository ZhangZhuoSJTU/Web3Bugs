import brownie
from brownie import VaderBond, TestToken, ZERO_ADDRESS

## Terms
CONTROL_VAR = 1e6
VESTING_TERM = 10000
MIN_PRICE = 0.1 * 1e6
MAX_PAYOUT = 1000
MAX_DEBT = 50 * 1e18
INITIAL_DEBT = 0
PAYOUT_TOTAL_SUPPLY = 1e7 * 1e18

## Adjustment
ADD = True
RATE = CONTROL_VAR * 3 / 100
TARGET = CONTROL_VAR * 2
BUFFER = 1


def test_constructor(deployer, treasury, payoutToken, principalToken):
    with brownie.reverts("treasury = zero"):
        VaderBond.deploy(ZERO_ADDRESS, payoutToken, principalToken, {"from": deployer})

    with brownie.reverts("payout token = zero"):
        VaderBond.deploy(treasury, ZERO_ADDRESS, principalToken, {"from": deployer})

    with brownie.reverts("principal token = zero"):
        VaderBond.deploy(treasury, payoutToken, ZERO_ADDRESS, {"from": deployer})

    bond = VaderBond.deploy(treasury, payoutToken, principalToken, {"from": deployer})

    assert bond.treasury() == treasury
    assert bond.payoutToken() == payoutToken
    assert bond.principalToken() == principalToken
    assert bond.owner() == deployer


def test_initialize_bond(deployer, user, bond):
    with brownie.reverts("not owner"):
        bond.initializeBond(
            CONTROL_VAR,
            VESTING_TERM,
            MIN_PRICE,
            MAX_PAYOUT,
            MAX_DEBT,
            INITIAL_DEBT,
            {"from": user},
        )

    with brownie.reverts("cv = 0"):
        bond.initializeBond(
            0,
            VESTING_TERM,
            MIN_PRICE,
            MAX_PAYOUT,
            MAX_DEBT,
            INITIAL_DEBT,
            {"from": deployer},
        )

    with brownie.reverts("vesting < 10000"):
        bond.initializeBond(
            CONTROL_VAR,
            9999,
            MIN_PRICE,
            MAX_PAYOUT,
            MAX_DEBT,
            INITIAL_DEBT,
            {"from": deployer},
        )

    with brownie.reverts("max payout > 1%"):
        bond.initializeBond(
            CONTROL_VAR,
            VESTING_TERM,
            MIN_PRICE,
            1001,
            MAX_DEBT,
            INITIAL_DEBT,
            {"from": deployer},
        )

    tx = bond.initializeBond(
        CONTROL_VAR,
        VESTING_TERM,
        MIN_PRICE,
        MAX_PAYOUT,
        MAX_DEBT,
        INITIAL_DEBT,
        {"from": deployer},
    )

    assert bond.terms()["controlVariable"] == CONTROL_VAR
    assert bond.terms()["vestingTerm"] == VESTING_TERM
    assert bond.terms()["minPrice"] == MIN_PRICE
    assert bond.terms()["maxPayout"] == MAX_PAYOUT
    assert bond.terms()["maxDebt"] == MAX_DEBT
    assert bond.totalDebt() == INITIAL_DEBT
    assert bond.lastDecay() == tx.block_number

    with brownie.reverts("initialized"):
        bond.initializeBond(
            CONTROL_VAR,
            VESTING_TERM,
            MIN_PRICE,
            MAX_PAYOUT,
            MAX_DEBT,
            INITIAL_DEBT,
            {"from": deployer},
        )


def test_set_adjustment(deployer, user, bond):
    with brownie.reverts("not owner"):
        bond.setAdjustment(
            ADD,
            RATE,
            TARGET,
            BUFFER,
            {"from": user},
        )

    with brownie.reverts("rate > 3%"):
        bond.setAdjustment(
            ADD,
            RATE + 1,
            TARGET,
            BUFFER,
            {"from": deployer},
        )

    bond.setAdjustment(
        ADD,
        RATE,
        TARGET,
        BUFFER,
        {"from": deployer},
    )

    adj = bond.adjustment()
    assert adj["add"] == ADD
    assert adj["rate"] == RATE
    assert adj["target"] == TARGET
    assert adj["buffer"] == BUFFER


def test_deposit(deployer, user, bond, treasury, principalToken, payoutToken):
    treasury.setBondContract(bond, True, {"from": deployer})

    payoutToken.mint(treasury, PAYOUT_TOTAL_SUPPLY)

    amount = 10 ** 6
    principalToken.mint(user, amount)
    principalToken.approve(bond, amount, {"from": user})

    max_price = 2 ** 256 - 1

    with brownie.reverts("depositor = zero"):
        bond.deposit(amount, max_price, ZERO_ADDRESS, {"from": user})

    with brownie.reverts("bond price > max"):
        bond.deposit(amount, 0, user, {"from": user})

    with brownie.reverts("payout < min"):
        bond.deposit(0, max_price, user, {"from": user})

    with brownie.reverts("payout > max"):
        bond.deposit(2 ** 128, max_price, user, {"from": user})

    value = treasury.valueOfToken(principalToken, amount)
    payout = bond.payoutFor(value)

    def snapshot():
        return {
            "principal": {
                "user": principalToken.balanceOf(user),
                "bond": principalToken.balanceOf(bond),
                "treasury": principalToken.balanceOf(treasury),
            },
            "payout": {
                "user": payoutToken.balanceOf(user),
                "bond": payoutToken.balanceOf(bond),
                "treasury": payoutToken.balanceOf(treasury),
            },
            "bond": {
                "totalDebt": bond.totalDebt(),
                "terms": bond.terms(),
                "adjustment": bond.adjustment(),
            },
        }

    before = snapshot()
    tx = bond.deposit(amount, max_price, user, {"from": user})
    after = snapshot()

    expires = tx.block_number + VESTING_TERM
    assert tx.events["BondCreated"].values() == [amount, payout, expires]

    assert after["principal"]["user"] == before["principal"]["user"] - amount
    assert after["principal"]["bond"] == before["principal"]["bond"]
    assert after["principal"]["treasury"] == before["principal"]["treasury"] + amount

    assert after["payout"]["user"] == before["payout"]["user"]
    assert after["payout"]["bond"] == before["payout"]["bond"] + payout
    assert after["payout"]["treasury"] == before["payout"]["treasury"] - payout

    info = bond.bondInfo(user)
    assert info["payout"] == payout
    assert info["vesting"] == VESTING_TERM
    assert info["lastBlock"] == tx.block_number

    assert after["bond"]["totalDebt"] > before["bond"]["totalDebt"]
    assert bond.lastDecay() == tx.block_number

    assert (
        after["bond"]["terms"]["controlVariable"]
        > before["bond"]["terms"]["controlVariable"]
    )
    assert bond.adjustment()["lastBlock"] == tx.block_number
    assert tx.events["ControlVariableAdjustment"].values() == [
        before["bond"]["terms"]["controlVariable"],
        after["bond"]["terms"]["controlVariable"],
        after["bond"]["adjustment"]["rate"],
        after["bond"]["adjustment"]["add"],
    ]


def test_redeem(chain, deployer, user, bond, treasury, principalToken, payoutToken):
    # test not depositor
    with brownie.reverts():
        bond.redeem(ZERO_ADDRESS, {"from": user})

    def snapshot():
        return {
            "payout": {
                "user": payoutToken.balanceOf(user),
                "bond": payoutToken.balanceOf(bond),
                "treasury": payoutToken.balanceOf(treasury),
            },
            "bond": {
                "info": bond.bondInfo(user),
                "totalDebt": bond.totalDebt(),
            },
        }

    # test percent vested < 100%
    assert bond.percentVestedFor(user) > 0
    assert bond.pendingPayoutFor(user) > 0

    before = snapshot()
    tx = bond.redeem(user, {"from": user})
    after = snapshot()

    assert after["payout"]["user"] > before["payout"]["user"]
    assert after["payout"]["treasury"] == before["payout"]["treasury"]
    assert after["payout"]["bond"] < before["payout"]["bond"]

    assert after["bond"]["info"]["payout"] < before["bond"]["info"]["payout"]
    assert after["bond"]["info"]["vesting"] < before["bond"]["info"]["vesting"]
    assert after["bond"]["info"]["lastBlock"] == tx.block_number

    # test remaining payout
    print(f"waiting for vesting term... {VESTING_TERM} blocks")
    chain.mine(VESTING_TERM)

    assert bond.percentVestedFor(user) >= 1e4
    assert bond.pendingPayoutFor(user) > 0

    before = snapshot()
    tx = bond.redeem(user, {"from": user})
    after = snapshot()

    assert after["payout"]["user"] > before["payout"]["user"]
    assert after["payout"]["treasury"] == before["payout"]["treasury"]
    assert after["payout"]["bond"] < before["payout"]["bond"]

    assert after["bond"]["info"]["payout"] < before["bond"]["info"]["payout"]
    assert after["bond"]["info"]["vesting"] < before["bond"]["info"]["vesting"]
    # record is deleted
    assert after["bond"]["info"]["lastBlock"] == 0

    assert bond.percentVestedFor(user) == 0
    assert bond.pendingPayoutFor(user) == 0


def test_set_treasury(deployer, user, bond):
    with brownie.reverts("not owner"):
        bond.setTreasury(
            ZERO_ADDRESS,
            {"from": user},
        )

    tx = bond.setTreasury(
        ZERO_ADDRESS,
        {"from": deployer},
    )

    assert bond.treasury() == ZERO_ADDRESS

    assert len(tx.events) == 1
    assert tx.events["TreasuryChanged"].values() == [ZERO_ADDRESS]


def test_recover_lost_tokens(deployer, user, bond, principalToken, payoutToken):
    token = TestToken.deploy("TEST", "TEST", 18, {"from": deployer})
    token.mint(bond, 111)

    with brownie.reverts("not owner"):
        bond.recoverLostToken(
            token,
            {"from": user},
        )

    with brownie.reverts("protected"):
        bond.recoverLostToken(
            principalToken,
            {"from": deployer},
        )

    with brownie.reverts("protected"):
        bond.recoverLostToken(
            payoutToken,
            {"from": deployer},
        )

    bond.recoverLostToken(
        token,
        {"from": deployer},
    )

    assert token.balanceOf(bond) == 0
