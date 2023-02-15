from brownie import chain
from brownie.test import strategy
import pytest

WEEK = 7 * 86400


class StateMachine:
    """
    Validate gauge weights and gauge weight sum.

    Strategies
    ----------
    st_type : Decimal
        Gauge type, multiplied by `len(self.gauges)` to choose a value
    st_gauge_weight : int
        Gauge weight
    st_type_wiehgt : int
        Type weight
    """

    st_type = strategy("decimal", min_value=0, max_value="0.99999999")
    st_gauge_weight = strategy("uint", min_value=10 ** 17, max_value=10 ** 19)
    st_type_weight = strategy("uint", min_value=10 ** 17, max_value=10 ** 19)

    def __init__(self, PoolGauge, admin, gauge_controller, mock_lp_token, minter):
        self.PoolGauge = PoolGauge
        self.admin = admin

        self.lp_token = mock_lp_token
        self.minter = minter
        self.controller = gauge_controller

    def setup(self):
        self.type_weights = []
        self.gauges = []

    def initialize_add_type(self, st_type_weight):
        """
        Add a new gauge type.

        This is also included as an intialize to increase the number of types early in the test.
        """
        self.rule_add_type(st_type_weight)

    def rule_add_type(self, st_type_weight):
        """
        Add a new gauge type.
        """
        self.controller.add_type(b"Type!", st_type_weight, {"from": self.admin})
        self.type_weights.append(st_type_weight)

    def rule_add_gauge(self, st_type, st_gauge_weight):
        """
        Add a new gauge.

        If no types have been added, this rule has not effect.
        """
        if not self.type_weights:
            return

        gauge_type = int(st_type * (len(self.type_weights)))
        gauge = self.PoolGauge.deploy(self.lp_token, self.minter, {"from": self.admin})
        self.controller.add_gauge(gauge, gauge_type, st_gauge_weight, {"from": self.admin})
        self.gauges.append({"contract": gauge, "type": gauge_type, "weight": st_gauge_weight})

    def _gauge_weight(self, idx):
        return sum(i["weight"] for i in self.gauges if i["type"] == idx)

    def invariant_gauge_weight_sums(self):
        """
        Validate the gauge weight sums per type.
        """
        for idx in range(len(self.type_weights)):
            gauge_weight_sum = self._gauge_weight(idx)
            assert self.controller.get_weights_sum_per_type(idx) == gauge_weight_sum

    def invariant_total_type_weight(self):
        """
        Validate the total weight.
        """
        total_weight = sum(
            self._gauge_weight(idx) * weight for idx, weight in enumerate(self.type_weights)
        )

        assert self.controller.get_total_weight() == total_weight

    def invariant_relative_gauge_weight(self):
        """
        Validate the relative gauge weights.
        """
        chain.sleep(WEEK)

        total_weight = sum(
            self._gauge_weight(idx) * weight for idx, weight in enumerate(self.type_weights)
        )

        for gauge, weight, idx in [(i["contract"], i["weight"], i["type"]) for i in self.gauges]:
            self.controller.checkpoint_gauge(gauge)
            expected = 10 ** 18 * self.type_weights[idx] * weight // total_weight

            assert self.controller.gauge_relative_weight(gauge) == expected

@pytest.mark.xfail(reason = "curve-dao-types-not-yet-supported")
def test_gauge(state_machine, PoolGauge, admin, gauge_controller, mock_lp_token, minter):
    state_machine(StateMachine, PoolGauge, admin, gauge_controller, mock_lp_token, minter)
