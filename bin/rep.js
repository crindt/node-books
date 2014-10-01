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
  self._chtot = function() { return _.reduce( this.children, function( sum, ch ) { return sum + ch.total() }, 0 )},
  self.total = function() { return this._bal }

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
    _chtot: function() { return _.reduce( this.children, function( sum, ch ) { return sum + ch.total() }, 0 )},
    total: function() { return this._bal }
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
while ( (line = lines.shift()) !== undefined ) {
  //console.log(_.map(p,function(v,k) { console.log(k,v.name) }).join("\n"))

  var m;
  //console.log(line)
  if ( m = line.match(/(\s*)(\$\s-?[\d,\.]+)(\s\s)(\s*)([^\s].*)/) ) {
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
        _chtot: function() { return _.reduce( this.children, function( sum, ch ) { return sum + ch.total() }, 0 )},
        total: function() { return this._bal }

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
}
function tablerow(c1,c2,w1,w2) {
  console.log("|",sprintf("%"+w1+"s",c1),"|",sprintf("<tt>%-"+w2+"s</tt>",c2),"|")
}

var idts = 2;//'&nbsp;&nbsp;&nbsp;&nbsp;'

function acct(a,idt,p) {
  if ( !idt ) idt = 0
  var n = a.name;
  var lines = []
  if ( p ) n = [p,n].join(":")
  // break out sub accounts if there are children or if it's a required top-level account
  if ( a.children.length > 1 || n.match(/^(Liabilities|Equity|Assets)/) ) {
    //tablerow([idt,n].join(""),"",20,10)
    lines.push({idt:idt,n:n,v:""})
    _.each(a.children, function( ch ) { lines.push(acct(ch, idt+idts)) });

    if ( Math.abs(a.bal()) > 0.005 )  // parent account has balance, report as "Other"
      //tablerow([idt+"  ",n+" - Other"].join(""),a.bal()+idts,20,10)
      lines.push({idt:idt+idts,n:n+" - Other",v:accounting.formatMoney(a.bal(), "\\$ ", 2, ",", ".")})

    //tablerow([idt,"Total ",n].join(''),accounting.formatMoney(a.total(), "\\$ ", 2, ",", ".")+idt,20,10)
    lines.push({idt:idt,n:"Total "+n,v:accounting.formatMoney(a.total(), "\\$ ", 2, ",", ".")})
  } else if ( a.children.length == 1 ) {
    if ( Math.abs(a.bal()) > 0.005 ) {   // parent account has balance, report as "Other"
      lines.push({idt:idt,n:n,v:""})     // report parent account (without amount, we'll total this below
      lines.push(acct(a.children[0],idt+idts,n))  // note that the lone child must be indented further
      //tablerow([idt+"  ",n+" - Other"].join(""),a.bal(),20,10)
      lines.push({idt:idt+idts,n:n+" - Other",v:accounting.formatMoney(a.bal(), "\\$ ", 2, ",", ".")})
      //tablerow([idt,"Total ",n].join(''),accounting.formatMoney(a.total(), "$ ", 2, ",", ".")+idt,20,10)
      lines.push({idt:idt,n:"Total "+n,v:accounting.formatMoney(a.total(), "\\$ ", 2, ",", ".")})
    } else {
      lines.push(acct(a.children[0],idt,n))
    }
  } else {
    //tablerow([idt,n].join(""),accounting.formatMoney(a.bal(),"$ ",2, ",", ".")+idt,20,10)
    lines.push({idt:idt,n:n,v:accounting.formatMoney(a.bal(),"\\$ ",2, ",", ".")})
  }
  return _.flatten(lines)
}

// make sure core accounts exist
_.each(['Liabilities', 'Assets', 'Equity'], function(a) {
  if ( !accts[a] ) accts[a] = new Account(a);
});

//acct(accts['root'],'')
/*
console.log("|",sprintf("%"+20+"s",""),"|",sprintf("%-10s",""),"|") // head
console.log("|:-------------------|---------:|") // head
console.log('| ASSETS             |          |')
acct(accts['Assets'],idts)
console.log('| TOTAL ASSETS       |',accounting.formatMoney(accts['Assets'].total(),"$ ",2, ",", "."),'|')
console.log('| LIABILITIES AND EQUITY |      |')
acct(accts['Liabilities'],idts)
acct(accts['Equity'],idts)
console.log('| TOTAL LIABILITIES AND EQUITY |',accounting.formatMoney(accts['Liabilities'].total()+accts['Equity'].total(),"$ ",2, ",", "."),"|")
*/

var doT=require('dot')

doT.templateSettings.strip=false

var templ=doT.template(fs.readFileSync('bs.templ').toString())

ast = accts['Assets']
lia = accts['Liabilities']
ety = accts['Equity']

//console.log(acct(ast).lines)

console.log(templ({accounting:accounting,
                   assets: {lines:acct(ast),
                            act: ast,
                            tot:accounting.formatMoney(ast.total(),"\\$ ",2, ",", ".")
                           },
                   liab:   {lines:acct(lia),
                            act: lia,
                            tot:accounting.formatMoney(lia.total(),"\\$ ",2, ",", ".")
                           },
                   eqty:   {lines:acct(ety),
                            act: ety,
                            tot:accounting.formatMoney(ety.total(),"\\$ ",2, ",", ".")
                           }
                  }))
