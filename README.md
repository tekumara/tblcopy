# tblcopy

`tblcopy` reads CSV from stdin, converts it to a rich-text table, and copies the RTF table to the macOS clipboard.

## Requirements

- Node.js 20 or newer
- macOS, with `textutil` and `osascript` available on `PATH`

## Usage

```sh
cat table.csv | tblcopy
```

Example:

```sh
printf 'Name,Amount\nCoffee,4.50\nRent,1200\n' | tblcopy
```

The first CSV row is rendered as table headers. Quoted CSV fields, escaped quotes, CRLF line endings, and embedded newlines are supported.

## Development

```sh
npm install
npm test
npm start < table.csv
```
