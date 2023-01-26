# Modlite

**Note that while function calls work function arguments do not work properly at the moment.**

## syntax

Start by creating a main function:

```modlite
function main() void {
	
}
```

This function is named `main` and takes no arguments ( `()` ) and returns nothing (`void`).

## JavaScript RunTime

To run a binary Import `./virtualMachine/modlite.js` and run:
```JavaScript
const runTime = new ModliteRunTime()
```

To add exposed functions to the runTime:
```JavaScript
runTime.exposedFunctions[function_name] = () => {
	// code
}
```

## Swift RunTime _(unfinished)_

The Swift runTime is intended to be a mirror of the JavaScript runTime.