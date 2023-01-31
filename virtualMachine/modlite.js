/*
	RunTime version 2

	For JavaScript.
	Can running a web browser and should be able to run in node.
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

	//
	// Jumping
	//

	// jump to a location (takes a single character off the stack. The place to jump into is determined by this characters charCode)
	jump: "g",
	// jump but only if a condition is true (does not do anything right now)
	conditionalJump: "h",
	// jumps to code in the host programming language
	externalJump: "i",

	//
	// math
	//

	// add: "j",
	// subtract: "k",
	// multiply: "l",
	// divide: "o",
	
	// break character
	break: "\uFFFF",
}

class ModliteRunTime {
	exposedFunctions = {}
	stack = []
	arp = 0 // activation record pointer
	reset = () => {
		this.stack = []
	}
	run = (binary) => {
		let i = 0;
		while (i < binary.length) {
			const char = binary[i];

			// uncomment this to watch the stack change while running
			// for (const key in binaryCodes) {
			// 	if (binaryCodes[key] == char) {
			// 		console.log(i, key, "stack:", JSON.stringify(this.stack))
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
				for (let index = 0; index < amount; index++) {
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
			
			else if (char == binaryCodes.jump) {
				// if the stack is empty end program
				if (this.stack.length == 0) break
				const location = charToBaseTen(this.stack.pop())
				// console.log("jump", location)
				i = location
				continue
			}
			
			else if (char == binaryCodes.conditionalJump) {
				// const location = Number(goToBreak())
				// const condition = this.stack.pop()
				// console.log("conditionalJump", location, condition)
				// if (condition == "1") {
				// 	i = location
				// }
			}
			
			else if (char == binaryCodes.externalJump) {
				const name = this.stack.pop()
				// console.log("externalJump", name)
				this.exposedFunctions[name]()
			}
			
			else {
				throw "unexpected character: " + char + " at " + i
			}

			i++
		}
	
		function goToBreak() {
			let past = ""
			while (true) {
				const char = binary[++i];
				if (!char || char == "\uFFFF") {
					return past
				} else {
					past += char
				}
			}
		}
	}
}

function charToBaseTen(char) {
	return Number(char.charCodeAt(0).toString(10));
}

// uncomment this when using node
export default ModliteRunTime