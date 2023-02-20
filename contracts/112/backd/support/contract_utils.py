import re
import pytest
from support.constants import ADMIN_DELAY


def update_topup_handler(topup_action, protocol, new_handler, chain, admin):
    topup_action.prepareTopUpHandler(protocol, new_handler, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    topup_action.executeTopUpHandler(protocol, {"from": admin})
