// -*- js-indent-level: 2 -*-

var fs = require('fs')
var _ = require('lodash')
var accounting = require('accounting')
var sprintf = require('sprintf-js').sprintf

function Account(aname) {
  var self = {
    name: aname,
    children: [],
    parent: null,
    idt: -2,
    _bal: 0,
  }

  self.bal = function() { return this._bal - this._chtot() }
  self._chtot = function() { return _.reduce( this.children, function( sum, ch ) { return sum + ch._bal }, 0 )}
  self.total = function() { return this._bal }
  self.allZero = function() { return this._bal==0 && _.reduce( this.children, function( az, ch ) {
    return az && ch.allZero()
  }, true )}

  return self;
}

var accts = {
  root:
  { name: 'root',
    children: [],
    parent: null,
    idt: -2,
    _bal: 0,
    bal: function() { return this._bal - this._chtot() },
    _chtot: function() { return _.reduce( this.children, function( sum, ch ) { return sum + ch._bal }, 0 )},
    total: function() { return this._bal },
    allZero: function() { return this._bal==0 && _.reduce( this.children, function( az, ch ) {
      return az && ch.allZero()
    }, true )}
  }
}


function pstr(a) {
  return [(a.parent ? pstr(a.parent) : "" ), a.name].join(":")
}

var last = accts['root']
var lastidt = -2
var p = {0:last}
var idts = {}
data = fs.readFileSync('/dev/stdin')

var lines = data.toString().split("\n")

var line
var shifted = []
var company = ""
var from = ""
var to = ""
var lastline = ""
while ( (line = lines.shift()) !== undefined ) {
  _.map(p,function(v,k) { console.log(k,v.name) }).join("\n")

  var m;
  if ( /^-----/.test(lastline) && ( m = line.match(/(\s*)(\$\s*-?[\d,\.]+)/) ) ) {
    net = accounting.unformat(m[2])
    //console.log("NET IS", net)

  } else if ( (m = line.match(/^profit and loss state?ment for\s+(.*?)\s*$/i )) ) {
    company = m[1]

  } else if (( m = line.match(/^\s*(.*)\sto\s(.*?)\s*$/i)) ) {
    from = m[1]
    to = m[2]

  } else if ( (m = line.match(/(\s*)(\$?\s*-?[\d,\.]+)(\s\s)(\s*)([^\s].*)/)) ) {
    var baseidt = m[4].length

    // clear old shifted at levels above this one
    _.each(_.range(baseidt,10,2), function(l) { shifted[l] = "" });
    //console.log('shifted',shifted)

    // set new shifted (if appropriate)
    shifted[baseidt] = (m[5].split(/:/).length-1) * 2;


    var adjbaseidt = baseidt+_.reduce(shifted.slice(0,baseidt), function(sum,ll) { return sum+(ll?ll:0)}, 0)
    //console.log('idts',m[5],baseidt,adjbaseidt)

    // loop over nested accounts reported on a single line
    var tidt = adjbaseidt
    _.each(m[5].split(/:/), function(a) {
      //console.log('>>>>>',a,'tidt',tidt,'lastidt',lastidt)
      if ( tidt > lastidt ) {
        //console.log("Updating parent idt",tidt)
        p[tidt] = last
        lastidt = tidt
      }
      var n = a
      //console.log(JSON.stringify(p))
      //console.log("account",n,"idt",tidt,"will have parent",p[tidt].name)
      var a = {
        name: n,
        idt: tidt,
        _bal: accounting.unformat(m[2]),
        parent: p[tidt],
        children: [],
        bal: function() { return this._bal - this._chtot() },
        _chtot: function() { return _.reduce( this.children, function( sum, ch ) { return sum + ch._bal }, 0 )},
        total: function() { return this._bal },
	      allZero: function() { return this._bal==0 && _.reduce( this.children, function( az, ch ) {
	        return az && ch.allZero()
	      }, true )}

      }
      accts[a.name] = a
      //console.log('idt',a.idt,"BALBALBAL",m[1],a._bal)
      a.parent.children.push(a);
      last = a
      lastidt = tidt
      tidt += 2   // drop to next level of ident
      p[tidt] = a
      //console.log("Pushed",pstr(a),a.name,tidt-2)
    });
  }
  lastline = line
}
function tablerow(c1,c2,w1,w2) {
  console.log("|",sprintf("%"+w1+"s",c1),"|",sprintf("<tt>%-"+w2+"s</tt>",c2),"|")
}

var idts = 2;//'&nbsp;&nbsp;&nbsp;&nbsp;'

var cursym = ""; //"\\$ "
var curfmt = function(amt) {
  return accounting.formatMoney(amt, cursym, 2, ",", ".");
}

function acct(a,idt,p,last) {
  if ( !idt ) idt = 0
  var n = a.name;
  var lines = []
  if ( a.allZero() && false ) return lines;  // this account and all children have exactly zero balance
  if ( p ) n = [p,n].join(":")
  // break out sub accounts if there are children or if it's a required top-level account
  if ( a.children.length >= 1 || n.match(/^(Income|Expense)/) ) {
    //tablerow([idt,n].join(""),"",20,10)
    lines.push({idt:idt,n:n,q:0,v:""})
    _.each(a.children, function( ch, i ) {
      lines.push(acct(ch, idt+idts, null, i == a.children.length-1))
    });

    if ( Math.abs(a.bal()) > 0.005 ) { // parent account has balance, report as "Other"
      //tablerow([idt+"  ",n+":[Other]"].join(""),a.bal()+idts,20,10)
      lines.push({idt:idt+idts,n:"[other]",q:a.bal(),bar:true,v:curfmt(a.bal())})
    }

    lines[lines.length-1].bar=true

    //tablerow([idt,"Total ",n].join(''),accounting.formatMoney(a.total(), cursym, 2, ",", ".")+idt,20,10)
    lines.push({idt:idt,n:"Total "+n,bar:last,q:a.total(),v:curfmt(a.total())})

  } else if ( a.children.length == 1 ) { // NOT USED IF WE EXPAND ALL ACCOUNTS (>= on previous conditional)
    if ( Math.abs(a.bal()) > 0.005 ) {   // parent account has balance, report as "Other"
      lines.push({idt:idt,n:n,q:0,v:""})     // report parent account (without amount, we'll total this below
      lines.push(acct(a.children[0],idt+idts,n))  // note that the lone child must be indented further
      lines.push({idt:idt+idts,n:"[other]",bar:true,q:a.bal(),v:curfmt(a.bal())})
      lines.push({idt:idt,n:"Total "+n,bar:last,q:a.total(),v:curfmt(a.total())})
    } else {
      lines.push(acct(a.children[0],idt,n,true))
    }
  } else {
    //tablerow([idt,n].join(""),accounting.formatMoney(a.bal(),"$ ",2, ",", ".")+idt,20,10)
    lines.push({idt:idt,n:n,q:a.bal(),v:curfmt(a.bal())})
  }
  return _.flatten(lines)
}

// make sure core accounts exist
_.each(['Liabilities', 'Assets', 'Equity'], function(a) {
  if ( !accts[a] ) accts[a] = new Account(a);
});

var doT=require('dot')

doT.templateSettings.strip=false

var templ=doT.template(fs.readFileSync('pl.templ').toString())

inc = accts['Income']
exp = accts['Expenses']

var inclines = acct(inc)
inclines[inclines.length-1].bar=true
var explines = acct(exp)
explines[explines.length-1].bar=true


console.log(templ({accounting:accounting,
		   from:from,
		   to:to,
		   company:company,
		   net:net,
		   curfmt: curfmt,
		   idts: idts,
                   inc: {lines:inclines,
                         act: inc,
                         tot:curfmt(inc.total())
                        },
                   exp:   {lines:explines,
                           act: exp,
                           tot:curfmt(exp.total())
                          },
                  }))
