const binaryCodes = {

	//
	// information management
	//

	// retrive: "r",

	// string: "a",
	// number: "b",
	// null: "c",
	// bool: "d",

	push: "a",
	pop: "b",

	//
	// Jumping
	//

	// Relative jump?

	jump: "e",
	conditionalJump: "f",
	// jumps to code in the host programming language
	externalJump: "g",
	return: "z",

	//
	// math
	//

	// add: "h",
	// subtract: "i",
	// multiply: "j",
	// divide: "k",

	break: "\uFFFF",
}

var experimentalProgram = [
	binaryCodes.push,"Hello World",binaryCodes.break,
	binaryCodes.externalJump,"print",binaryCodes.break,

	// binaryCodes.push,"0",binaryCodes.break,
	// binaryCodes.jump,

	binaryCodes.push,"error",binaryCodes.break,
	binaryCodes.externalJump,"print",binaryCodes.break,
].join("")

class ModliteRunTime {
	exposedFunctions = {}
	stack = []
	reset = () => {
		this.stack = []
	}
	run = (binary) => {
		let i = 0;
		while (i < binary.length) {
			const char = binary[i++];
			if (char == binaryCodes.push) {
				const data = goToBreak()
				// console.log("push", data)
				this.stack.push(data)
			} else if (char == binaryCodes.pop) {
				this.stack.pop()
				// console.log("pop", )
			} else if (char == binaryCodes.jump) {
				const location = Number(this.stack.pop())
				// console.log("jump", location)
				i = location
			} else if (char == binaryCodes.conditionalJump) {
				// const location = Number(goToBreak())
				// const condition = this.stack.pop()
				// console.log("conditionalJump", location, condition)
				// if (condition == "1") {
				// 	i = location
				// }
			} else if (char == binaryCodes.externalJump) {
				const name = this.stack.pop()
				// console.log("externalJump", name)
				this.exposedFunctions[name]()
			} else {
				console.log("ignore", char)
			}
		}

		function goToSpaceOrBreak() {
			let past = ""
			while (true) {
				const char = binary[i++];
				if (!char || char == " " || char == "\uFFFF") {
					return past
				} else {
					past += char
				}
			}
		}
	
		function goToBreak() {
			let past = ""
			while (true) {
				const char = binary[i++];
				if (!char || char == "\uFFFF") {
					return past
				} else {
					past += char
				}
			}
		}
	
		function goForChars(length) {
			let past = ""
			for (let index = 0; index < length; index++) {
				past += binary[i++];
			}
			return past
		}
	}
}

// uncomment this when using node

// export default ModliteRunTime