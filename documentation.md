# Modlite Documentation

**this documentation is incomplete and still being added to**

The syntax is similar to JavaScript with a few differences.

Remember that:
- everything is type checked
- no commas (not because commas are bad but because it is easier to parse without commas)
	- this may change in later versions

## Syntax Overview

### import
```modlite
import { function1 function2 } from "path_to_a_file"
```

### function
```modlite
function main(): Void {
	// your code
}
```

Arguments Contain a name, type and are not separated by commas.
```modlite
function main(string: String num1: Number num2: Number): Void {
	
}
```

The main function will be run when your program starts.
```modlite
function main(): Void {}
```

## Hello World Example

Start by importing printLine from the StandardLibrary.
```modlite
import { printLine } from "StandardLibrary"
```

Then create the main function.
```modlite
// this function will be run when your program starts
function main(): Void {
	
}
```

In the main function add a printLine function call.
```modlite
printLine("Hello, World")
```

# types

* String
	* a pointer to a list of Uint8s ending at a 0x00