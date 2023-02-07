/*
	RunTime version 11

	For JavaScript.
	Can run a web browser or node.
*/

const binaryCodes = {
	//
	// information management
	//

	push: "a",
	// remove most recent thing on the stack
	pop: "b",
	addRegisters: "c",
	removeRegisters: "d",
	// set the value of a register
	set: "e",
	// get the value of a register
	get: "f",
	// set the value of a global
	setGlobal: "g",
	// get the value of a global
	getGlobal: "h",

	//
	// Jumping
	//

	// jump to a location (takes a single character off the stack. The place to jump into is determined by this characters charCode)
	jump: "i",
	// jump but only if a condition is true
	conditionalJump: "j",
	// jump but only if a condition is false
	notConditionalJump: "k",
	// jumps to code outside of the binary
	externalJump: "l",

	//
	// math
	//

	add: "m",
	subtract: "n",
	multiply: "o",
	divide: "p",
	
	// check to see if two values are equivalent
	equivalent: "q",
	// join to strings
	join: "r",
	// reverse a bool
	// true = false and false = true
	not: "z",
	// break character
	break: "\uFFFF",
}

class ModliteRunTime {
	// add the MLSL (Modlite standard library) this includes functions like print, error and startsWith
	exposedFunctions = {
		["MLSL:print"]: () => {
			console.log(this.stack.pop())
		},
		["MLSL:error"]: () => {
			console.error("[error]", this.stack.pop(), "\n")
			console.error("index", this.index)
			console.error("arp", this.arp)
			console.error("stack", this.stack)
			console.error("globals", this.globals, "\n")
			console.error("program ending early\n")
	
			this.reset()
		},
		["MLSL:startsWith"]: () => {
			const startString = this.stack.pop()
			const string = this.stack.pop()
			this.stack.push(string.startsWith(startString) ? "1" : "0")
		},
	}
	index = 0
	binary = ""
	stack = []
	globals = []
	arp = 0 // activation record pointer
	reset = () => {
		this.index = 0
		this.binary = ""
		this.stack = []
		this.globals = []
		this.arp = 0
	}
	run = () => {
		const goToBreak = () => {
			let past = ""
			while (true) {
				const char = this.binary[++this.index];
				if (!char || char == "\uFFFF") {
					return past
				} else {
					past += char
				}
			}
		}

		while (this.index < this.binary.length) {
			const char = this.binary[this.index];

			// uncomment this to watch the stack change while running
			// for (const key in binaryCodes) {
			// 	if (binaryCodes[key] == char) {
			// 		console.log(this.index, key, "stack:", JSON.stringify(this.stack))
			// 		break
			// 	}
			// }

			if (char == binaryCodes.push) {
				const data = goToBreak()
				// console.log("push", data)
				this.stack.push(data)
			}
			
			else if (char == binaryCodes.pop) {
				const amount = Number(goToBreak())
				// console.log("pop", amount)
				this.stack.splice(this.stack.length - amount, amount)
			}
			
			else if (char == binaryCodes.addRegisters) {
				this.stack.push(this.arp)
				this.arp = this.stack.length-1
				const amount = Number(goToBreak())
				// console.log("addRegisters", amount)
				for (let i = 0; i < amount; i++) {
					this.stack.push(undefined)
				}
				
			}
			
			else if (char == binaryCodes.removeRegisters) {
				const amount = Number(goToBreak())
				// console.log("removeRegisters", amount)
				this.stack.splice(this.stack.length - amount, amount)
				this.arp = this.stack.pop()
			}
			
			else if (char == binaryCodes.set) {
				const int = goToBreak()
				const value = this.stack.pop()
				// console.log("set", int, value)
				this.stack[Number(this.arp)+Number(int)] = value
			}
			
			else if (char == binaryCodes.get) {
				const int = goToBreak()
				// console.log("get", int)
				this.stack.push(this.stack[Number(this.arp)+Number(int)])
			}

			else if (char == binaryCodes.setGlobal) {
				const int = goToBreak()
				const value = this.stack.pop()
				// console.log("setGlobal", int, value)
				this.globals[Number(int)] = value
			}
			
			else if (char == binaryCodes.getGlobal) {
				const int = goToBreak()
				// console.log("getGlobal", int)
				this.stack.push(this.globals[Number(int)])
			}
			
			else if (char == binaryCodes.jump) {
				// if the stack is empty end program
				if (this.stack.length == 0) break
				const location = charToBaseTen(this.stack.pop())
				// console.log("jump", location)
				this.index = location
				continue
			}
			
			else if (char == binaryCodes.conditionalJump) {
				const location = charToBaseTen(this.stack.pop())
				const condition = this.stack.pop()
				// console.log("conditionalJump", location, condition)
				if (condition == "1") {
					this.index = location
					continue
				}
			}

			else if (char == binaryCodes.notConditionalJump) {
				const location = charToBaseTen(this.stack.pop())
				const condition = this.stack.pop()
				// console.log("notConditionalJump", location, condition)
				if (condition == "0") {
					this.index = location
					continue
				}
			}
			
			else if (char == binaryCodes.externalJump) {
				const name = this.stack.pop()
				// console.log("externalJump", name)
				this.exposedFunctions[name]()
			}

			else if (char == binaryCodes.add) {
				const number2 = this.stack.pop()
				const number1 = this.stack.pop()

				// console.log("add", number1, number2)

				this.stack.push(String(Number(number1) + Number(number2)))
			}

			else if (char == binaryCodes.subtract) {
				const number2 = this.stack.pop()
				const number1 = this.stack.pop()

				// console.log("subtract", number1, number2)

				this.stack.push(String(Number(number1) - Number(number2)))
			}

			else if (char == binaryCodes.multiply) {
				const number2 = this.stack.pop()
				const number1 = this.stack.pop()

				// console.log("multiply", number1, number2)

				this.stack.push(String(Number(number1) * Number(number2)))
			}

			else if (char == binaryCodes.divide) {
				const number2 = this.stack.pop()
				const number1 = this.stack.pop()

				// console.log("divide", number1, number2)

				this.stack.push(String(Number(number1) / Number(number2)))
			}

			else if (char == binaryCodes.equivalent) {
				const value2 = this.stack.pop()
				const value1 = this.stack.pop()

				// console.log("equivalent", value1, value2)

				this.stack.push(value1 == value2 ? "1" : "0")
			}

			else if (char == binaryCodes.join) {
				const string2 = this.stack.pop()
				const string1 = this.stack.pop()

				this.stack.push(string1 + string2)
			}

			else if (char == binaryCodes.not) {
				const bool = this.stack.pop()

				this.stack.push(bool == "0" ? "1" : "0")
			}
			
			else {
				throw `unexpected character: '${char}'(${charToBaseTen(char)}) at ${this.index}`
			}

			this.index++
		}
	}
}

function charToBaseTen(char) {
	return Number(char.charCodeAt(0).toString(10));
}

// uncomment this when using node
export default ModliteRunTime