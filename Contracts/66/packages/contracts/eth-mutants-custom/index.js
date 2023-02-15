#!/usr/bin/env node

const yargs = require('yargs')
const commands = require('./src/commands')

yargs
  .usage('$0 <cmd> [args]')
  .command('test', 'run mutation tests', (yargs) => {
    yargs.option('failfast', {
      type: 'bool',
      default: false,
      describe: 'abort on first surviving mutant'
    })
  }, commands.test)
  .command('preflight', 'print preflight summary', commands.preflight)
  .help()
  .argv
