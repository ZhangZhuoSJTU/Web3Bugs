def add_action(address_provider, topUpAction):
    assert not address_provider.isAction(topUpAction)
    assert len(address_provider.allActions()) == 0

    tx = address_provider.addAction(topUpAction)
    assert tx.return_value
    assert address_provider.isAction(topUpAction)
    assert len(address_provider.allActions()) == 1

    tx = address_provider.addAction(topUpAction)
    assert not tx.return_value
    assert len(address_provider.allActions()) == 1


def test_add_action(address_provider, topUpAction):
    add_action(address_provider, topUpAction)
