#!/usr/bin/env node
// -*- javascript -*-
var prog = require('commander');

prog
  .version('0.0.1')
  .command('bs', "Show balance sheet")
  .command('pl', 'Show profit and loss')
  .command('job', 'Show books for jobs')
  .command('check', 'Check ledger file for consistent references')

prog.on('--help', function(){
  console.log('  Discussion:');
  console.log('');
  console.log('    books is a simple wrapper for ledger-cli.')
  console.log('    Use the -v switch on any command to see the ledger command executed')
  console.log('');
});


prog.parse(process.argv);

if ( prog.args.length < 1 ) prog.help()


