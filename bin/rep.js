// -*- js-indent-level: 2 -*-

var fs = require('fs')
var _ = require('lodash')
var accounting = require('accounting')
var sprintf = require('sprintf-js').sprintf
var books = require('..')
var prog = books.prog()  // loads defaults
  .option('--invert-liab-and-equity', 'Invert the signs of liabilities and equity totals (i.e., make net-income positive)')
  .parse(process.argv);

function ivt(a) { 
  return ( prog.invertLiabAndEquity && a.fullname().match(/^root:(Liabilities|Equity)/) ? -1 : 1 )
}
  

function Account(aname) {
  var self = {
    name: aname,
    children: [],
    parent: null,
    idt: -2,
    _bal: 0,
  }

  
  self.fullname = function() { return ( this.parent ? this.parent.fullname()+":" : "")+this.name }
  self.bal = function() { return ivt(this) * (this._bal - this._chtot()) }
  self._chtot = function() { return _.reduce( this.children, function( sum, ch ) { return sum + ch._bal }, 0 )}
  self.total = function() { return ivt(this) * (this._bal) }
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
    fullname: function() { return ( this.parent ? this.parent.fullname()+":" : "")+this.name },
    bal: function() { return ivt(this) * (this._bal - this._chtot()) },
    _chtot: function() { return _.reduce( this.children, function( sum, ch ) { return sum + ch._bal }, 0 )},
    total: function() { return ivt(this) * this._bal },
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
  //console.log(_.map(p,function(v,k) { console.log(k,v.name) }).join("\n"))

  var m;
  //console.log(line)
  if ( lastline.match(/^-----/) && ( m = line.match(/(\s*)(\$\s*-?[\d,\.]+)/) ) ) {
    net = accounting.unformat(m[2])
    //console.log("NET IS", net)

  } else if ( m = line.match(/^balance sheet for\s+(.*?)\s*$/i ) ) {
    company = m[1]

  } else if ( m = line.match(/^\s*as\sof\s(.*?)\s*$/i) ) {
    to = m[1]

  } else if ( m = line.match(/(\s*)(\$?\s*-?[\d,\.]+)(\s\s)(\s*)([^\s].*)/) ) {
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
        fullname: function() { return ( this.parent ? this.parent.fullname()+":" : "")+this.name },
        bal: function() { return ivt(this) * (this._bal - this._chtot()) },
        _chtot: function() { return _.reduce( this.children, function( sum, ch ) { return sum + ch._bal }, 0 )},
        total: function() { return ivt(this) * this._bal },
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
  var n = a.name
    .replace(/^xxx[^-]*-/,"") // remove leading sorting chars from upstream
  var lines = []
  if ( a.allZero() ) {
    // process.stderr.write(["ACCOUNT IS ALL ZERO",
    //     		  n,
    //     		  a._bal,
    //     		 "\n"].join(" "))
    return lines;  // this account and all children have exactly zero balance
  } 
  // process.stderr.write(["ACCOUNT IS NOT ALL ZERO",
  //       		n,
  //       		a._bal,
  //       		"\n"].join(" "))
    
  if ( p ) n = [p,n].join(":")
  // break out sub accounts if there are children or if it's a required top-level account
  if ( ( a.children.length >= 1 &&  Math.abs(a._chtot()) > 0.005) || n.match(/^(Liabilities|Equity|Assets)/) ) {
    //tablerow([idt,n].join(""),"",20,10)
    lines.push({idt:idt,n:n,q:0,v:""})
    _.each(a.children, function( ch, i ) { 
      var clines = acct(ch, idt+idts, null, i == a.children.length-1)
      lines.push(clines)
    });

    if ( Math.abs(a.bal()) > 0.005 ) { // parent account has balance, report as "Other"
      
      process.stderr.write(["ACCOUNT",
			    a.name,
			    "HAS OTHER VALUE",
			    a.bal(),
			    a._bal,
			    _.map(a.children,function(c) { return c.name + "[" + c._bal + "]"; }).join(":"),
			    "\n"].join(" "))
      lines.push({idt:idt+idts,n:"[other]",bar:true,q:a.bal(),v:curfmt(a.bal())})
    }

    lines.push({idt:idt,n:"Total "+n,bar:last,q:a.total(),v:curfmt(a.total())})

  } else if ( a.children.length == 1 ) { // NOT USED IF WE EXPAND ALL ACCOUNTS (>= on previous conditional)
    if ( Math.abs(a.bal()) > 0.005 ) {   // parent account has balance, report as "Other"
      lines.push({idt:idt,n:n,q:0,v:""})     // report parent account (without amount, we'll total this below
      lines.push(acct(a.children[0],idt+idts,n))  // note that the lone child must be indented further
      lines.push({idt:idt+idts,n:"[other]",bar:true,q:a.bal(),v:curfmt(a.bal())})
      lines.push({idt:idt,n:"Total "+n,bar:last,q:a.total(),v:curfmt(a.total())})
    } else {
      clines = acct(a.children[0],idt,n,true)
      lines.push(clines)
    }
  } else {
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

var templ=doT.template(fs.readFileSync('bs.templ').toString())

ast = accts['Assets']
lia = accts['Liabilities']
ety = accts['Equity']

//console.log(acct(ast).lines)

var astlines = acct(ast)
var lialines = acct(lia)
var etylines = acct(ety)

console.log(templ({accounting:accounting,
		   from:from,
		   to:to,
		   company:company,
		   curfmt: curfmt,
		   idts: idts,
                   assets: {lines:astlines,
                            act: ast,
                            tot:curfmt(ast.total())
                           },
                   liab:   {lines:lialines,
                            act: lia,
                            tot:curfmt(lia.total())
                           },
                   eqty:   {lines:etylines,
                            act: ety,
                            tot:curfmt(ety.total())
                           }
                  }))
