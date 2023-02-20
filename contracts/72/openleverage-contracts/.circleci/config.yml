version: 2
jobs:
  build:
    docker:
      # specify the version you desire here
      - image: circleci/node:14.17.5

      # Specify service dependencies here if necessary
      # CircleCI maintains a library of pre-built images
      # documented at https://circleci.com/docs/2.0/circleci-images/
      # - image: circleci/mongo:3.4.4
#      - image: trufflesuite/ganache-cli
#        command: ganache-cli --mem

    resource_class: large

    working_directory: ~/repo

    branches:
      only: main

    steps:
      - checkout

      # Download and cache dependencies
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package.json" }}
            # fallback to using the latest cache if no exact match is found
            - v1-dependencies-

      - run: npm install

      - save_cache:
          paths:
            - node_modules
          key: v1-dependencies-{{ checksum "package.json" }}

      - run:
          name: Running Ganache-CLI as background
          command: export NODE_OPTIONS="--max_old_space_size=4096" && ./node_modules/.bin/ganache-cli
          background: true

      - run: export FASTMODE=true && ./node_modules/.bin/truffle test # triggers truffle test
