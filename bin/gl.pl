#!/usr/bin/perl
use Date::Format;
use Date::Parse;
use Getopt::Long;

my $show_receipts=0;
my $by_month=0;
GetOptions ("receipts"  => \$show_receipts,
            "by-month" => \$by_month)
    or die("Error in command line arguments\n");

my @trans = ();
my @rcpt = ();
my @invc = ();
my $mainnote = "";
my $lastmonth;

print <<EOF;
\\setuppapersize[letter]
\\setuppagenumbering[location={footer,middle},style=\\bfc]

\\newdimen\\myborderoffset \\myborderoffset=0.75in
\\definelayout[mypage][page]
\\setuplayout[mypage][
	backspace=\\myborderoffset,
	topspace=\\myborderoffset
]
\\setuplayout[mypage]
\\starttext
\\tfxx
\\setupTABLE[frame=off,width=\\textwidth]
\\setupTABLE[row][each][width=0.8\\textwidth]
\\setupTABLE[c][1,2][width=0.1\\textwidth]
\\setupTABLE[c][3][width=0.6\\textwidth]
\\setupTABLE[c][4][width=0.1\\textwidth,align=left]
\\setupTABLE[c][5][width=0.1\\textwidth,align=left]
\\usecolors[xwi]
\\definecolor[darky][h=787878]
EOF

my $tcnt;
my @colors = ("white","gray");
my $cnt;
my $bgc;
my $intab;
my $dtime;
while (<>) {
    chomp();

    if ( /^$/ ) {
        # print trans
        print STDERR "PRINTING TRANSACTION ".@trans[1]."\n";
        print STDERR "        WITH RECEIPT ".@rcpt[0]."\n" if @rcpt;
        if ( @rcpt ) {
            push @trans, join(
                "\n",
                map {
                    if ( /<MISSING>/ ) {
                        ""
                    } else {
                        s/ALT://; # remove ALT: heading
                        # check for pdf options, like page number
                        my @p=/^(.*\.(pdf|png|jpg))(\s*\[(.*)\])?.*$/i;
                        my $f = $p[0];
                        $f = $_ if ( !$f ); # nomatch on filename in regex above, revert to original
                        print STDERR "PPPPPP:  ".join(",",@p)."\n";
                        print STDERR "FIGURE:  ".$f."\n";
                        my @opts = ("height=2in");
                        if ( $p[3] ) { push(@opts,$p[3]) };
                        my $opts = join(",",@opts);
                        print STDERR "FIGURE OPTS:  ".$opts."\n";
                        join("",
                             "\\bTR[$bgc]\\bTD[nc=2]\\eTD",
                             "\\bTD[nc=2]",
                             "\\rotate[rotation=0]{\\framed[background=color,backgroundcolor=white]{\\externalfigure[$f][$opts]}}\n",
                             "\\eTD\\eTR");
                }
                } @rcpt
                );
        }
        push @trans, "\\bTR[$bgc]\\eTR";  # add blank line at end
        my $tt = join("\n",@trans)."\n";
        # escape dollar signs, pounds, and percents
        $tt =~ s/([\$\#\%])/\\$1/g;
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
            push @trans, "\\bTR[topframe=on,rulethickness=.1pt,$bgc]\n\\bTD[nc=3]\\bf";
            push @trans, $_;
            push @trans, "\\eTD\\bTD~\\eTD\\bTD~\\eTD\n\\eTR";
            $mainnote = "";
            my $fulldate;
            /^((\d{4})[-\/](\d{2})[-\/](\d{2}))\s+(.*)/ && do {
                $fulldate = $1;
                $month = $3;
                $mainnote = $5;
            };
            if ( $by_month && ( $month ne $lastmonth ) ) {

                $dtime = str2time($fulldate);
                $dfmt  = time2str("%B %Y", $dtime);

                if ( $intab ) {
                    print <<EOFet;
\\eTABLEbody
\\eTABLE
EOFet
                }
                print <<EOF4;
\\page[yes,makeup]
\\title{\\tfa General Ledger for $dfmt}
\\bTABLE[split=repeat]
\\bTABLEhead\\bTR[background=color,backgroundcolor=black]\\bTH[nc=3]\\color[white]{Description} \\eTH\\bTH \\color[white]{Debit}\\eTH\\bTH \\color[white]{Credit}\\eTH\\eTR\\eTABLEhead
\\bTABLEbody
EOF4
            } elsif ( !$intab ) {
                print <<EOFbyyear;
\\bTABLE[split=repeat]
\\bTABLEhead\\bTR[background=color,backgroundcolor=black]\\bTH[nc=3]\\color[white]{Description} \\eTH\\bTH \\color[white]{Debit}\\eTH\\bTH \\color[white]{Credit}\\eTH\\eTR\\eTABLEhead
\\bTABLEbody
EOFbyyear
            }
            $lastmonth = $month;
            $intab = 1;

        } elsif ( /^\s+;\s*(.*)/ ) {
            # read metadata
            my $meta = $1;
            my ($tag,@vala) = split(/\s*:\s*/,$meta);
            $tag =~ s/^\s*//g;
            my $val = join(":",@vala);
            print STDERR "TAG:$tag=$val\n";

            if ( $tag =~ /^invoice/i ) {
                # should push
                push @invc, $val if ( $show_receipts );

            } elsif ( $tag =~ /^receipt/i ) {
                push @rcpt, $val if ( $show_receipts);
                print STDERR "PUSHING RECEIPT:$val\n"
            } elsif ( $tag =~ /^(statement)/i ) {
                # ignore
            } elsif ( $tag =~ /^(ofxid|fitid|source)/i ) {
                # skip
            } else {
                push @trans, "\\bTR[$bgc]\\bTD[nc=2]\\eTD";
                push @trans, "\\bTD[nc=2]{\\emph\\color[darky]{";
                push @trans, $meta;
                push @trans, "}}\\eTD\n\\eTR";
            }

        } else {
            # read split
            push @trans, "\\bTR[$bgc]\\bTD\\eTD "; ##% NEW SPLIT";
            /^\s*(.*?)(\s{2}\s*((-?\s*\$|\$\s*-?)\s*[\d,]+(\.\d+)?|(-?\s*[\d,]+(\.\d+)?\s*[a-zA-Z]+)|\([^\)]+\)|)\s*([\(\{=].*?|\@.*?)?)?(;(.*))?\s*$/ || warn "CAN'T READ IT: $_\n";
            my $acct = $1;
            my $dol = "\$";
            my $amt = $3;
            my $note = $10;
            my $extra = $8;
            $acct =~ s/\[/\\m{\\lbrack{}}/g;
            $acct =~ s/\]/\\m{\\rbrack{}}/g;
            print STDERR join(":","amt",$amt,"note",$note,"extra",$extra),"\n";
            $note =~ s/\[.*?\]//g; # remove date notes
            my $neg = ($amt =~ /-/);
            $amt =~ s/-//g;
            push @trans, "\\bTD[nc=2] $acct \\eTD\\bTD ".($neg?$amt:"")." \\eTD\\bTD ".(!$neg?$amt:"")." \\eTD\n\\eTR";
            if ( $extra ) { push @trans, "\\bTR[$bgc]\\bTD[nc=2]\\eTD\\bTD {\\color[darky]{\\it{TRANSACTION RATE: $extra}}}\\eTD\\eTR"; };
            if ( $note ) { push @trans, "\\bTR[$bgc]\\bTD[nc=2]\\eTD\\bTD {\\color[darky]{\\it{$note}}}\\eTD\\eTR"; };

        }
    }
}

# um, I think there is one transaction left to print?
print STDERR "PRINTING TRANSACTION ".@trans[1]."\n";
print STDERR "        WITH RECEIPT ".@rcpt[0]."\n" if @rcpt;
if ( @rcpt ) {
    push @trans, join(
        "\n",
        map {
            if ( /<MISSING>/ ) {
                ""
            } else {
                s/ALT://; # remove ALT: heading
                # check for pdf options, like page number
                my @p=/^(.*\.(pdf|png|jpg))(\s*\[(.*)\])?.*$/i;
                my $f = $p[0];
                $f = $_ if ( !$f ); # nomatch on filename in regex above, revert to original
                print STDERR "PPPPPP:  ".join(",",@p)."\n";
                print STDERR "FIGURE:  ".$f."\n";
                my @opts = ("height=2in");
                if ( $p[3] ) { push(@opts,$p[3]) };
                my $opts = join(",",@opts);
                print STDERR "FIGURE OPTS:  ".$opts."\n";
                join("",
                     "\\bTR[$bgc]\\bTD[nc=2]\\eTD",
                     "\\bTD[nc=2]",
                     "\\rotate[rotation=0]{\\framed[background=color,backgroundcolor=white]{\\externalfigure[$f][$opts]}}\n",
                     "\\eTD\\eTR");
            }
        } @rcpt
        );
}
push @trans, "\\bTR[$bgc]\\eTR";  # add blank line at end
my $tt = join("\n",@trans)."\n";
# escape dollar signs, pounds, and percents
$tt =~ s/([\$\#\%])/\\$1/g;
print "\n$tt\n";

print <<EOF3;
\\eTABLEbody
\\eTABLE
\\stoptext
EOF3
