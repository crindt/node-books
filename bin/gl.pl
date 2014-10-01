#!/usr/bin/perl

my @trans = ();
my @rcpt = ();
my @invc = ();
my $mainnote = "";

print "\\starttext\n";

my $tcnt;
my @colors = ("white","gray");
my $cnt;
my $bgc;
print "\\tfxx\n";
print "\\setupTABLE[frame=off,width=\\textwidth]\n";
print "\\setupTABLE[row][each][width=0.8\\textwidth]\n";
print "\\setupTABLE[c][1,2][width=4em]\n";
print "\\setupTABLE[c][3][width=30em]\n";
#print "\\setupTABLE[c][4][width=6em,alignmentcharacter={.},aligncharacter=yes,align=middle]\n";
#print "\\setupTABLE[c][5][width=6em,alignmentcharacter={.},aligncharacter=yes,align=middle]\n";
print "\\setupTABLE[c][4][width=6em,align=left]\n";
print "\\setupTABLE[c][5][width=6em,align=left]\n";
print "\\bTABLE[split=yes]\n";
while (<>) {
    chomp();
    if ( /^$/ ) {
        # print trans
        if ( @rcpt ) {
            push @trans, join(
                "\n",
                map { 
                    if ( /<MISSING>/ ) {
                        ""
                    } else {
                        join("",
                             "\\bTR[$bgc]\\bTD[nc=2]\\eTD",
                             "\\bTD[nc=2]",
                             "\\rotate[rotation=90]{\\externalfigure[".$_."][height=2in]}\n",
                             "\\eTD\\eTR");
                    }
                } @rcpt
                );
        }
        push @trans, "\\bTR[$bgc]\\eTR";  # add blank line at end
        my $tt = join("\n",@trans)."\n";
        $tt =~ s/([\$\#])/\\$1/g;
        print "\n$tt\n";
        #print "\n\\starttyping\n$trans\\stoptyping\n";
        #map { print "\\rotate[rotation=90]{\\externalfigure[".$_."][height=2in]}\n" } @rcpt;
        # map { print "\\rotate[rotation=90]{\\externalfigure[".$_."][height=2in]}\n" } @invc;
        @trans = ();
        $cnt = 0;
        @rcpt = ();
    } else {
        if ( !$cnt++ ) {
            # first entry
            $tcnt++;
            $bgc = "background=color,backgroundcolor=".$colors[$tcnt%2];
            push @trans, "\\bTR[topframe=on,rulethickness=.1pt,$bgc]\n\\bTD[nc=5]\\bf";
            push @trans, $_;
            push @trans, "\\eTD\n\\eTR";
            $mainnote = "";
            /^(\d{4}[-\/]\d{2}[-\/]\d{2})\s+(.*)/ && do {
                $mainnote = $2;
            }
        } elsif ( /^\s+;\s*(.*)/ ) {
            my $meta = $1;
            my ($tag,@vala) = split(/\s*:\s*/,$meta);
            my $val = join(":",@vala);

            if ( $tag =~ /^invoice/i ) {
                # should push
                push @invc, $val;
            } elsif ( $tag =~ /^receipt/i ) {
                push @rcpt, $val;
            } elsif ( $tag =~ /^(statement)/i ) {
                # ignore
            } elsif ( $tag =~ /^(ofxid|fitid)/i ) {
                # skip
            } else {
                push @trans, "\\bTR[$bgc]\\bTD[nc=2]\\eTD";
                push @trans, "\\bTD[nc=2]";
                push @trans, $meta;
                push @trans, "\\eTD\n\\eTR";
            }
        } else {
            # split
            push @trans, "\\bTR[$bgc]\\bTD\\eTD % NEW SPLIT";
            /^\s*(.*?)(\s+(\$.*?)|\s+(-?\s*\d+[a-zA-Z]+)|)?((;(.*))|([\(\{\[].*))?$/ || warn "CAN'T READ IT: $_\n";
            my $acct = $1;
            my $amt = $2;
            my $note = $7;
            my $extra = $8;
            print STDERR join(":","amt",$amt,"note",$note),"\n";
            $note =~ s/\[.*?\]//g; # remove date notes
            my $neg = ($amt =~ /-/);
            $amt =~ s/-//g;
            push @trans, "\\bTD[nc=2] $acct \\eTD\\bTD ".($neg?$amt:"")." \\eTD\\bTD ".(!$neg?$amt:"")." \\eTD\n\\eTR";
            if ( $note ) { push @trans, "\\bTR[$bgc]\\bTD[nc=2]\\eTD\\bTD $note\\eTD\\eTR"; };

        }
    }
}
print "\\eTABLE\n";
print "\\stoptext\n";
