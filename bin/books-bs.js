#!/usr/bin/env node
// -*- javascript -*-
var moment = require('moment');
var _ = require('lodash');
var books = require('..')
var fs = require('fs')

var prog = books.prog()  // loads defaults
  .option('-b, --begin-date [date]', 'start date')
  .option('-e, --end-date [date]', 'The date for which to report the balance sheet [today]',moment().add(1,'day').format('YYYY-MM-DD'))
  .option('-m, --method [method]', 'The accounting method to use [cash]', 'cash')
  .option('-p, --partners [partners]', 'A comma separated list of partners for distributing earnings in the report')
  .option('--equity [account]', 'Name of the top-level equity account to use [Equity]', 'Equity')
  .parse(process.argv);

var lcommand=process.env.LEDGER || 'ledger'

console.log(prog.ledgerFile);

var args = []
args.push('bal')
args.push(['-X',prog.commodity])
if ( prog.pedantic ) args.push(['--pedantic'])
args.push(['^Assets', '^Liabilities', '^Equity'])

if ( prog.method == 'cash' ) 
  args.push(['--effective'])

args.push(prog.args)

// make sure we generate retained earnings for the correct start point
if ( !prog.beginDate ) {
  // if begin date isn't specified, use the beginning of the year relative to
  // the end date
  prog.beginDate = [moment(prog.endDate).year(),'01','01'].join("-");

  // exception: if endDate is the first day of the year, use the beginning of
  // the previous year
  if (moment(prog.beginDate) == moment(prog.endDate))
    prog.beginDate = moment(prog.endDate).add(-1,'year').format("YYYY-MM-DD")
}


// read main ledger file
var lfs = fs.readFileSync(prog.ledgerFile).toString();

// first retained earnings call computes (prior) retained earnings
prog.retainedEarnings( 
  ( !prog.partners
    ? prog.equity+":profit:retained-earnings"
    : _.map(prog.partners.split(","), function(m) { return prog.equity+":profit:retained-earnings:"+m })), 
  moment(prog.beginDate).format("YYYY-MM-DD"), 
  [lfs],
  function(re1) {
    var tfn1 = '/tmp/'+process.pid+'A.ledger'
    fs.writeFileSync(tfn1,re1)
    var ll1=lfs+"\n\n!include "+tfn1+"\n"
    if ( prog.verbose ) console.log(ll1)

    prog.retainedEarnings( 
      ( !prog.partners
        ? prog.equity+":profit:net-income"
        : _.map(prog.partners.split(","), function(m) { return prog.equity+":profit:net-income:"+m })), 
      moment(prog.endDate).add(0,'day').format("YYYY-MM-DD"), [ll1], function(re) {
        // second retained earnings call computes "net income"

        // re is a string containing a balancing retained-earnings journal entry

        var title = [
          "Balance Sheet for "+prog.company,
          "as of "+(prog.endDate.match(/today/)?moment():moment(prog.endDate)).format("YYYY-MM-DD")
        ].join("\n")

        // Now we're going to create a temporary top-level ledger that includes the
        // balancing entry

        // append the balancing entry.  
        //var ll=lfs+"\n\n"+re

        // for some reason, ledger crashes unless the balancing entry is placed in a
        // separate temp file that we include.  So we comment the above append and
        // dump the balancing retained earnings entry to a file and include that file
        // in our modified ledger
        var tfn = '/tmp/'+process.pid+'B.ledger'
        fs.writeFileSync(tfn,re)
        var ll = [ll1,'!include '+tfn+"\n\n"].join("\n\n")
        if ( prog.verbose ) console.log(ll)

        // exec the child to accept data on stdin
        if ( prog.verbose) console.log('original file',prog.ledgerFile)
        args.push(['-f','/dev/stdin'])

        // DON'T USE beginDate on the final balance sheet report
        //if ( prog.beginDate) args.push(['-b',prog.beginDate])

        args.push(['-e',moment(prog.endDate).add(1,'day').format("YYYY-MM-DD")])

        // include any extra command line args coming after --
        args.push(prog.args)

        // fork the ledger call waiting on stdin
        var child = prog.exec(args,title)

        // write the top-level (modified) ledger to stdin, which will execute the
        // forked ledger call and dump the balance sheet with proper Retained-Earnings
        // for the endDate
        child.stdin.write(ll)
        child.stdin.end()
      })
  })
