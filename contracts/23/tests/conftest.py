import pytest


@pytest.fixture(scope="module", autouse=True)
def shared_setup(module_isolation):
    pass
