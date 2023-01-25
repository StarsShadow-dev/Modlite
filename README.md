# Modlite

## JavaScript

To run a binary Import `./virtualMachine/modlite.js` and run:
```JavaScript
const runTime = new ModliteRunTime()
```

To add exposed functions to the run time:
```JavaScript
runTime.exposedFunctions[function_name] = () => {
	// code
}
```

## Swift _(unfinished)_

The Swift runTime is intended to be a mirror of the JavaScript run time.