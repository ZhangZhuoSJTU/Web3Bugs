from config import (
    BADGER_DEV_MULTISIG,
    WANT,
    LP_COMPONENT,
    REWARD_TOKEN,
    DEFAULT_GOV_PERFORMANCE_FEE,
    DEFAULT_PERFORMANCE_FEE,
    DEFAULT_WITHDRAWAL_FEE,
)


def test_deploy_settings(deployed):
    """
    Verifies that you set up the Strategy properly
    """
    strategy = deployed.strategy

    protected_tokens = strategy.getProtectedTokens()

    ## NOTE: Change based on how you set your contract
    assert protected_tokens[0] == WANT
    assert protected_tokens[1] == LP_COMPONENT
    assert protected_tokens[2] == REWARD_TOKEN

    assert strategy.governance() == BADGER_DEV_MULTISIG

    assert strategy.performanceFeeGovernance() == DEFAULT_GOV_PERFORMANCE_FEE
    assert strategy.performanceFeeStrategist() == DEFAULT_PERFORMANCE_FEE
    assert strategy.withdrawalFee() == DEFAULT_WITHDRAWAL_FEE
