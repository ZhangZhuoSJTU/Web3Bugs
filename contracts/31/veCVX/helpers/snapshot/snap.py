class Snap:
    def __init__(self, data, block, entityKeys):
        self.data = data
        self.block = block
        self.entityKeys = entityKeys

    # ===== Getters =====

    def balances(self, tokenKey, accountKey):
        return self.data["balances." + tokenKey + "." + accountKey]

    def shares(self, tokenKey, accountKey):
        return self.data["shares." + tokenKey + "." + accountKey]

    def get(self, key):
        if key not in self.data.keys():
            raise Exception("Key {} not found in snap data".format(key))
        return self.data[key]

    # ===== Setters =====

    def set(self, key, value):
        self.data[key] = value
