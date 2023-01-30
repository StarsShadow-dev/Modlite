# Modlite

**I am in the process of moving everything to node (a lot of things do not work right now)**

A work in progress programming language.

Currently compiles to a custom operation code and can run in JavaScript.

This programming language was created as a way to make mods for my game.

It consists of two parts:

**The compiler** That takes Modlite code and compiles it into an operation code.

**And the runTime** That runs an operation code.

# Syntax

Start by creating a main function:

```modlite
function main() void {
	
}
```

This function is named `main` and takes no arguments ( `()` ) and returns nothing (`void`).

# RunTime

The RunTime is designed to be very fast and simple to run.

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

To run an opCode:
```JavaScript
runTime.run(opCode)
```

## Swift _(unfinished)_

The Swift runTime is intended to be a mirror of the JavaScript runTime.