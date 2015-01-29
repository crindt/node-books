var _ = require('lodash')
var sys = require('sys')
var spawn = require('child_process').spawn;
var accounting = require('accounting')
var fs = require('fs')
require('colors')

var lcommand=process.env.LEDGER || 'ledger'

var exec = function( args, title ) {

  if ( this.verbose ) console.log(lcommand, _.flatten(args).join(' '))

  if ( title ) {
    console.log(title)
    console.log("")
  }
  var child = spawn(lcommand, _.flatten(args), 
                    { stdio: ['pipe', process.stdout, 'pipe'] }
                   );

  var err=""
  var cnt=0
  child.stderr.on('data', function(d) {
    // highlight errors and warnings
    var dc = d.toString()
    console.log(dc)
    err += _.map(dc.split(/\n/), function(dcc) {
      if ( dcc.match(/^In file/) ) dcc = "-----\n"+dcc.blue
      if ( dcc.match(/^Warning/) ) dcc = dcc.yellow
      if (dcc.match(/^Error/) ) dcc = dcc.red+"\n-----"
      return dcc
    }).join("\n")
  })


  child.on('exit', function(err) {
    if ( err ) {
      process.stderr.write("\nReported errors and warnings:\n")
      process.stderr.write(err);
    }
  })

  return child;
}


Math.sign = function(v) {
  if ( v === 0 ) return 1;
  else return v/Math.abs(v)
}


/**
 * Function to call ledger and compute retained earnings
 */
var retainedEarnings = function(eqacct, e, incl, cb) {
  var pp = this
  var args = []


  // construct an equity command to compute balancing totals for the end date
  args.push('equity')
  args.push(['-f', '/dev/stdin'])
  args.push(['-e', e])
  args.push(['^Income','^Expenses'])
  if ( pp.method == 'cash' ) args.push(['--effective'])
  args.push(pp.args)  // add any supplementation CL args passed after --

  if ( this.verbose ) console.log(lcommand, _.flatten(args).join(" "))

  var err = ""
  var outstr = ""
  var ch = spawn(lcommand, _.flatten(args), 
                 { stdio: ['pipe', 'pipe', 'pipe'] });


  ch.stderr.on('data', function(d) {
    err += d.toString();
    console.log(err)
  })

  ch.stdout.on('data', function(d) {
    outstr += ''+d.toString();
  })

  var ll1=incl.join("\n")
  if ( this.verbose ) console.log(ll1)
  ch.stdin.write(ll1)
  ch.stdin.end()


  ch.on('exit', function(code,sig) {

    // OK, process the output of the equity command to produce a virtual journal
    // entry that moves the net of all Income-Expenses into Equity:Retained-Earnings

    //console.log(outstr.split("\n"))
    var ss = _.map(outstr.split("\n"), function(s) {
      return s
        .replace(/^(.*?)\s+Opening Balances\s*$/, [e," Closing Entry"].join(""))
        .replace(/^(\s{4})(.*?)(\s{2,}|\t)(([^\s]*?)(\s*)(-?)([\d,\.]+)(.*))$/, function(m,p1,p2,p3,p4,p5,p6,p7,p8,p9) {
          if ( Array.isArray(eqacct) && p2.match(/Opening\s+Balances/)) {
            // split retaining earnings to partner subaccounts
            var amt = -(accounting.unformat(p4)+0);

            // splitting may cause rounding errors, recapture...
            var damt = amt/eqacct.length
            var camt = Math.sign(damt)*Math.floor(100*Math.abs(damt))/100
            var roundingerr = Math.round((amt-camt*eqacct.length)*100)/100

            var a1 = [p1,p2,p3,accounting.formatMoney(camt+roundingerr, p5+" ", 2, "", "."),p9].join("");
            var a = [p1,p2,p3,accounting.formatMoney(camt, p5+" ", 2, "", "."),p9].join("");
            var tarr = eqacct.slice()
            var acs =[
              a1.replace(/Equity:Opening\s+Balances/, tarr.shift()),  // first partner gets the rounding error
              _.map(tarr, function(ac) {                      // remaining partners get the basic splits
                return a.replace(/Equity:Opening\s+Balances/, ac);
              })
            ]
            return _.flatten(acs).join("\n")
          } else {
            var a = [p1,p2,p3,accounting.formatMoney(-(accounting.unformat(p4)+0), p5+" ", 2, "", "."),p9].join("");
            return a.replace(/Equity:Opening\s+Balances/, eqacct);
          }
        })
        .replace(/^(.*Closing Entry.*$)/g,"$1\n    ; LEGACY: Hack-for-tag-assertions")
    }).join("\n")

    if ( err ) {
      process.stderr.write("\nReported errors and warnings (retained earnings):\n")
      process.stderr.write(err);
    }

    // return the retained earnings journal entry
    cb(ss)
  })
}



module.exports.prog = function(pp) {
  var prog = pp || require('commander')

  prog
    .version('0.0.1')
    .option('-f, --ledger-file <filename>', 'The ledger file to process [books.ledger]','books.ledger')
    .option('-c, --company <string>', 'Company name to use on report [Company]', "Company")
    .option('-v, --verbose', 'Be verbose', false)
    .option('-h, --highlight', 'Highlight errors and warnings (instead of ledger outputs)')
    .option('-X, --commodity [commodity]', 'The commodity to report in [$]', '$')
    .option('-p, --pedantic', 'Halt on errors')
    .option('-s, --strict', 'Show warnings')

  prog.exec = exec
  prog.retainedEarnings = retainedEarnings

  return prog
}

