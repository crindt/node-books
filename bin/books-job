#!/usr/bin/env node
// -*- javascript -*-
var sys = require('sys')
var prog = require('commander');
var spawn = require('child_process').spawn;
var moment = require('moment');
var _ = require('lodash');
require('colors')

var prog = require('..').prog()  // loads defaults
  .option('-e, --end-date [date]', 'The date for which to report the balance sheet [today]',moment().format("YYYY-MM-DD"))
  .option('-m, --method [method]', 'The accounting method to use [cash]', 'cash')
  .parse(process.argv);

var args = []
args.push('bal')
args.push(['-f',prog.ledgerFile])
args.push(['-e',prog.endDate])
args.push(['-X',prog.commodity])

if ( prog.args.length < 1 ) throw new Error("Please specify the job(s) to report on")

args.push([_.map(prog.args,function(j){return '^jobs:'+j;})])

if ( prog.method == 'cash' ) 
  args.push(['--effective'])

args.push('--invert')


if ( prog.verbose ) console.log(lcommand, _.flatten(args).join(' '))
console.log("")

var title = [
  prog.company+" status for job: "+prog.args.join(", "),
  "As of "+prog.endDate
].join("\n")

prog.exec(args,title)
