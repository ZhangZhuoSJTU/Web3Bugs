FROM trufflesuite/ganache-cli:latest

ADD chaindb /tmp/chaindb

ENV NODE_OPTIONS "--max-old-space-size=16000"

ENTRYPOINT [ "node", \
             "/app/ganache-core.docker.cli.js", \
             "--db", "/tmp/chaindb", \
             "--networkId", "1337", \
             "--verbose", \
             "--mnemonic", "owner dignity sense" ]