node-books
==========

Wrapper around ledger-cli for generating standard reports.

## Installation

The following command will install the node-books executables, making the program and its subcommands available for use from any shell.

```
$ npm install -g node-books
```

## Disclaimer

`node-books` provides a number of commands for producing "standard" financial reports using the [ledger](http://ledger-cli.org/) command-line accounting tool.  These reports serve my particular needs.  I am not an accountant and no warranty is implied regarding their suitability for any purpose other than your own entertainment.

## Usage

`node-books` uses tjholowaychuk's [commander.js](https://github.com/visionmedia/commander.js/) package to provide a subcommand system similar to that used by the `git` executable.

```
$ books

  Usage: books [options] [command]

  Commands:

    bs          Show balance sheet
    pl          Show profit and loss
    job         Show books for jobs
    check       Check ledger file for consistent references
    help [cmd]  display help for [cmd]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number

  Discussion:

    books is a simple wrapper for ledger-cli.
    Use the -v switch on any command to see the ledger command executed
```

Help for a particular subcommand is available with the `--help` switch:

```
$ books bs --help

  Usage: books-bs [options]

  Options:

    -h, --help                    output usage information
    -V, --version                 output the version number
    -f, --ledger-file <filename>  The ledger file to process [books.ledger]
    -c, --company <string>        Company name to use on report [Company]
    -v, --verbose                 Be verbose
    -h, --highlight               Highlight errors and warnings (instead of ledger outputs)
    -X, --commodity [commodity]   The commodity to report in [$]
    -p, --pedantic                Halt on errors
    -s, --strict                  Show warnings
    -b, --begin-date [date]       start date
    -e, --end-date [date]         The date for which to report the balance sheet [today]
    -m, --method [method]         The accounting method to use [cash]
```

