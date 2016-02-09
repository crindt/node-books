#!/usr/bin/env node
// -*- javascript -*-
var moment = require('moment');
var _ = require('lodash');
var spawn = require('child_process').spawn;
var cheerio = require('cheerio')
var fs = require('fs')


var prog = require('..').prog()  // loads defaults
  .option('-e, --end-date [date]', 'The date for which to report check data [3000]',3000)
  .option('-m, --method [method]', 'The accounting method to use [cash]', 'cash')
  .parse(process.argv);

var lcommand=process.env.LEDGER || 'ledger'

var args = []
args.push('xml')
args.push(['-f',prog.ledgerFile])
args.push(['-e',prog.endDate])
args.push(['-X',prog.commodity])
args.push(['--real'])  // prevents some ledger errors with virtual transactions
if ( prog.strict ) args.push(['--strict'])

if ( prog.method == 'cash' )
  args.push(['--effective'])

args.push(prog.args)

if ( prog.verbose ) console.log(lcommand, _.flatten(args).join(' '))


var child = spawn(lcommand, _.flatten(args),
                  { stdio: ['pipe', 'pipe', 'pipe'] }
                 );
var xml=""
var err=""
var cnt=0
child.stdout.on('data', function(d) {
  // highlight errors and warnings
  xml += d.toString()
})

child.stderr.on('data', function(d) {
  var dc = d.toString()
  process.stderr.write(_.map(dc.split(/\n/), function(dcc) {
    if ( dcc.match(/^In file/) ) dcc = "-----\n"+dcc.blue
    if ( dcc.match(/^Warning/) ) dcc = dcc.yellow
    if (dcc.match(/^Error/) ) dcc = dcc.red+"\n-----"
    return dcc
  }).join("\n"))

})

child.stderr.on('data', function(d) {
  // highlight errors and warnings
})

child.on('exit', function() {
  var $ = cheerio.load(xml)

  _.each(['Receipt','Invoice'], function(type) {

    if ( prog.verbose ) console.log("Checking each",type,"tag")

    $('transaction').each(function(i,e) {
      var trans = this
      $(this).find('metadata value[key='+type+']').each(function(i,e) {
        var f = $(this).text().trim()

        var show =false
        if ( f.match(/\<MISSING\>/)) {
          s = "marked as missing".yellow
          if ( prog.pedantic || prog.verbose ) show = true
        } else if (!fs.existsSync(f)) {
          s = "MISSING".red
          show = true
        } else {
          stats = fs.lstatSync(f);
          if ( stats.isFile() ) {
            s = "present".green
            if ( prog.verbose ) show = true
          } else {
            s = "not a regular file!".red
            show = true
          }
        }
        if ( show ) console.log(type,"'"+f.red+"'",'is',s,'for',$(trans).find('date').text().blue,$(trans).find('payee').text().blue)
      });
    });
  });
});
