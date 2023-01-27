# Modlite

A work in progress programming language.

Currently compiles to a custom operation code and can run in JavaScript.

This programming language was created as a way to make mods for my game.

It consists of two parts:

**The compiler** That takes Modlite code and compiles it into an operation code.

**And the runTime** That runs an operation code.

# Syntax

**Note that while function calls work function arguments do not work properly at the moment.**

Start by creating a main function:

```modlite
function main() void {
	
}
```

This function is named `main` and takes no arguments ( `()` ) and returns nothing (`void`).

# Compiler

The compiler is written entirely in JavaScript and can run in a web browser

### The compiler has three steps:

## Lexing

Also known as tokenizing this step splits the code into tokens:

```JavaScript
Modlite_compiler.lex(`print("hello")`)
```

in
```modlite
print("hello")
```

out
```json
[
  {
    "type": "word",
    "value": "test",
    "lineNumber": 1
  },
  {
    "type": "punctuation",
    "value": "(",
    "lineNumber": 1
  },
  {
    "type": "string",
    "value": "hello",
    "lineNumber": 1
  },
  {
    "type": "punctuation",
    "value": ")",
    "lineNumber": 1
  }
]
```

## Parsing

The parser takes an array of tokens and outputs a scoped representation of the program.

in 
```json
[
  {
    "type": "word",
    "value": "test",
    "lineNumber": 1
  },
  {
    "type": "punctuation",
    "value": "(",
    "lineNumber": 1
  },
  {
    "type": "string",
    "value": "hello",
    "lineNumber": 1
  },
  {
    "type": "punctuation",
    "value": ")",
    "lineNumber": 1
  }
]
```

out
```json
[
  {
    "type": "call",
    "name": "test",
    "value": [
      {
        "type": "string",
        "value": "hello",
        "lineNumber": 1
      }
    ],
    "lineNumber": 1
  }
]
```

## Compiling

The compiler takes a build created by the parser and creates an operation code.

in
```json
[
  {
    "type": "function",
    "name": "main",
    "args": [],
    "return": "void",
    "value": [
      {
        "type": "call",
        "name": "test",
        "value": [
          {
            "type": "string",
            "value": "hi",
            "lineNumber": 2
          }
        ],
        "lineNumber": 2
      }
    ],
    "lineNumber": 1
  }
]
```
out
```
a￿gahi￿atest￿ig
```

# RunTime

The RunTime is designed to be very simple and fast to run.

## JavaScript

Import `./virtualMachine/modlite.js` and run:
```JavaScript
const runTime = new ModliteRunTime()
```

To add exposed functions to the runTime:
```JavaScript
runTime.exposedFunctions[function_name] = () => {
	// code
}
```

To run a binary:
```JavaScript
runTime.run(opCode)
```

## Swift _(unfinished)_

The Swift runTime is intended to be a mirror of the JavaScript runTime.