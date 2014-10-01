#!/usr/bin/env node
// -*- javascript -*-
var moment = require('moment');
var _ = require('lodash');

var now = moment();

var prog = require('..').prog()  // loads defaults
  .option('-b, --begin-date <date>', 'The date for which to report the P&L [today]')
  .option('-e, --end-date <date>', 'The date for which to report the P&L [today]')
  .option('-y, --year <year>', 'The year for which to report the P&L ['+now.year()+']')
  .option('-m, --method <method>', 'The accounting method to use [cash]', 'cash')
  .parse(process.argv);

console.log(prog.ledgerFile);

if ( prog.year ) {
    if (prog.beginDate || prog.endDate ) {
      throw new Error("Don't use both year and begin/end date")
    } else {
      var year = parseInt(prog.year)
      prog.beginDate = moment(year+"-01-01").format("YYYY-MM-DD")
      prog.endDate = moment((year+1)+"-01-01").format("YYYY-MM-DD")
    }
} else if ( !prog.beginDate && !prog.endDate ) {
  var year = now.year()
  prog.beginDate = moment(year+"-01-01").format("YYYY-MM-DD")
  prog.endDate = moment().format("YYYY-MM-DD")
} 

// default beginDate to start of current year and endDate to today
if ( !prog.beginDate ) prog.beginDate = moment((now.year())+"-01-01").format("YYYY-MM-DD")
if ( !prog.endDate )   prog.endDate = moment().format("YYYY-MM-DD")

if ( moment(prog.beginDate) > moment(prog.endDate) ) {
  throw new Error("Begin date "+prog.beginDate+" is after end date "+prog.endDate)
}


var args = []
args.push('bal')
args.push(['-f',prog.ledgerFile])
args.push(['-b',prog.beginDate])
args.push(['-e',prog.endDate])
args.push(['-X',prog.commodity])
args.push(['^Income','^Expenses','^Currency'])

if ( prog.method == 'cash' ) 
  args.push(['--effective'])

args.push('--invert')

args.push(prog.args)


var title = [
  "Profit and Loss Statment for "+prog.company,
  prog.beginDate+" to "+prog.endDate
  ].join("\n")

prog.exec(args,title)
