const binaryCodes = {

	//
	// information management
	//

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

	//binaryCodes.jump,0,binaryCodes.break,
	binaryCodes.push,"error",binaryCodes.break,
	binaryCodes.externalJump,"print",binaryCodes.break,
].join("")

class ModliteRunTime {
	exposedFunctions = {}
	stack = []
	run = (binary) => {
		let i = 0;
		while (i < binary.length) {
			const char = binary[i++];
			if (char == binaryCodes.push) {
				const data = goToBreak()
				console.log("push", data)
				this.stack.push(data)
			} else if (char == binaryCodes.pop) {
				console.log("pop", this.stack.pop())
			} else if (char == binaryCodes.jump) {
				const location = Number(goToBreak())
				console.log("jump", location)
				i = location
			} else if (char == binaryCodes.conditionalJump) {
				const location = Number(goToBreak())
				const condition = this.stack.pop()
				console.log("conditionalJump", location, condition)
				if (condition == "1") {
					i = location
				}
			} else if (char == binaryCodes.externalJump) {
				const name = goToSpaceOrBreak()
				console.log("externalJump", name)
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