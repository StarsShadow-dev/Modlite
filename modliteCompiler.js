// Modlite Rewrite 13

/* 
	A work in progress programming language.
	Currently compiles to a custom operation code and can run in JavaScript.

	node modliteCompiler.js ./tests/print
	node modliteCompiler.js ./tests/print --log
*/

// Modlite building environment
const Modlite_compiler = {
	version: "13.2.0",
	string: "",

	reservedWords: [
		"if",
		"else",
		"switch",
		"while",
		"true",
		"false",
		"as",
	],
	
	binaryCodes: {
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
	},
}

// custom tokenizer/lexar
Modlite_compiler.lex = (stringin) => {
	// add a space at the end of the string this simplifies lexing
	Modlite_compiler.string = stringin + " "
	let context = { lineNumber: 1, column: 0, i: 0 } 
	let tokens = []

	while (context.i < Modlite_compiler.string.length) {
		// char stands for character
		const char = next_char()

		// if the character exists and it is not a space or a line break
		if (char && !char.match(/[ \t\n]/)) read_next(char)
	}

	function read_next(char) {

		// default with the regular expression /[a-zA-Z\_]/ ("a" to "z" || "A" to "Z" || "_")
		if (char.match(/[a-zA-Z\_]/)) {
			back_char()
			const name = read_while((char) => {return char.match(/[a-zA-Z0-9\_]/)})
			push_token("word", name)
		}

		else if (char == "@") {
			const lineNumber = context.lineNumber
			const name = read_while((char) => {
				return char != " " && char != "\n" && char != "<"
			})

			const newChar = next_char()

			if (newChar == "<") {
				const args = read_while((char) => {
					return char != ">"
				}).split(" ")
				next_char()

				tokens.push({
					type: "compilerSetting",
					value: [name, args],
					lineNumber: lineNumber,
				})
			} else {
				tokens.push({
					type: "compilerSetting",
					value: [name, []],
					lineNumber: lineNumber,
				})
			}
		}

		else if (char.match(/[\"\'\`]/)) {
			// startLine is only for the unexpected EOF (unexpected end of file) error
			const startLine = context.lineNumber
			const openingChar = char
			let escaped = false
			function loop() {
				let past = ""
				while (true) {
					const loop_char = next_char()
					// if the character does not exist end right now
					if (!loop_char) {
						back_char()
						return past
					}
					if (loop_char == "\\") {
						if (escaped == true) {
							past += loop_char
							escaped = false
						} else {
							escaped = true
						}
					} else {
						if (!escaped && loop_char == openingChar) {
							back_char()
							return past
						}
						if (escaped) {
							if (loop_char == "n") {
								past += "\n"
							} else if (loop_char == "t") {
								past += "\t"
							}
						} else {
							past += loop_char
						}
						escaped = false
					}
				}
			}
			push_token("string", loop())
			// eat the ending character
			context.i++
			context.column++
			// if the lex ended with a string still active (probably because the programmer forgot to end it) fail the lex
			if (!Modlite_compiler.string[context.i]) err(`unexpected EOF a string that started at line ${startLine} never ended`)
		}

		else if (char.match(/[0-9]/)) {
			back_char()
			push_token("number", Number(read_while((in_char) => {return in_char.match(/[0-9\.]/)})))
		}

		// if both characters are a slash that means a comment is happening
		else if (char == "/" && Modlite_compiler.string[context.i] == "/") {
			read_while((char) => {return char != "\n"})
		}

		/*
			for multiline comments like this
		*/
		else if (char == "/" && Modlite_compiler.string[context.i] == "*") {
			read_while((char) => {
				return !(char == "*" && Modlite_compiler.string[context.i] == "/")
			})
			// eat the "*" and the "/"
			next_char()
			next_char()
		}

		else if (char.match(/[\(\)\{\}\:]/)) {
			push_token("separator", char)
		}

		else if (char.match(/[\+\-\*\/\=\<\>\.\!]/)) {
			const next = next_char()
			if (char == "=" && next == "=") {
				push_token("operator", "==")
			} else if (char == "!" && next == "=") {
				push_token("operator", "!=")
			} else if (char == "." && next == ".") {
				push_token("operator", "..")
			} else {
				back_char()
				push_token("operator", char)
			}
		}

		// if it is not a known character throw an error
		else {
			err(`unexpected character "${char}"`)
		}
	}

	function next_char() {
		const char = Modlite_compiler.string[context.i++];
		if (char == "\n") {
			context.lineNumber++
			context.column = 0
		} else {
			context.column++
		}
		return char
	}

	function back_char() {
		context.i--
		context.column--
		if (Modlite_compiler.string[context.i] == "\n") {
			context.lineNumber--
		}
	}

	function push_token(type, value) {
		tokens.push({
			type,
			value,
			lineNumber: context.lineNumber,
		})
	}

	function read_while(func) {
		var past = ""
		while (true) {
			const char = next_char()
			if (char && func(char)) {
				past += char
			} else {
				back_char()
				return past
			} 
		}
	}

	function err(msg) {
		Modlite_compiler.handle_error(msg, context.lineNumber)
		throw "[lexar error]";
	}

	return tokens
}

Modlite_compiler.parse = (context, tokens, inExpression) => {
	context.level++
	let build = []

	while (context.i < tokens.length) {
		const token = next_token()

		// console.log(`${context.i}/${tokens.length} in loop, looking at token ${token.type}:`, token)

		if (token.type == "word") {

			// console.log("word", token)

			if (token.value == "true") {
				push_to_build({
					type: "bool",
					value: true,
				})
			} else if (token.value == "false") {
				push_to_build({
					type: "bool",
					value: false,
				})
			} else if (token.value == "null") {
				push_to_build({
					type: "null",
				})
			} else if (token.value == "public") {
				const next = next_token()
				if (next.type != "word") err("unexpected 'public' keyword")
				if (next.value == "function") {
					parse_function(next, true)
				} else if (next.value == "var") {
					parse_var(next, true)
				} else {
					err("unexpected 'public' keyword")
				}
			} else if (token.value == "function") {
				parse_function(token, false)
			} else if (token.value == "var") {
				parse_var(token, false)
			} else if (token.value == "import") {
				parse_import()
			} else if (token.value == "if") {
				parse_if()
			} else if (token.value == "switch") {
				parse_switch()
			} else if (token.value == "while") {
				parse_while()
			} else if (token.value == "return") {
				parse_return()
			} else {
				push_to_build({
					type: "var",
					value: token.value,
				})
			}
		}

		else if (token.type == "compilerSetting") {
			if (token.value[0] == "end") {
				return build
			}
			const parse = Modlite_compiler.parse(context, tokens, false)

			push_to_build({
				type: "compilerSetting",
				name: token.value[0],
				args: token.value[1],
				build: parse,
				lineNumber: token.lineNumber
			})
		}

		else if (token.type == "separator") {

			// console.log("separator", token)

			if (token.value == "(") {
				const past = build.pop()
	
				if (!past) err("unexpected (")
	
				if (past.type == "var" && past.value == "case") {
					const condition = Modlite_compiler.parse(context, tokens, false)
					next_token()
					const statement = Modlite_compiler.parse(context, tokens, false)
	
					push_to_build({
						type: "case",
						condition: condition,
						statement: statement
					})
				} else {
					push_to_build({
						type: "call",
						name: past.value,
						args: Modlite_compiler.parse(context, tokens, false),
					})
				}
			} else if (token.value == ")") {
				return build
			} else if (token.value == "{") {
				err("unexpected {")
			} else if (token.value == "}") {
				return build
			} else if (token.value == ".") {
				err("not available "+token.value)
				// const next = next_token()
				// if (next.type == "separator" && next.value == ".") {
				// 	push_to_build({
				// 		type: "join",
				// 		left: [build.pop()],
				// 		right: [Modlite_compiler.parse(context, tokens, true)[0]],
				// 	})
				// } else {
				// 	// undo the next_token()
				// 	back_token()
				// 	push_to_build({
				// 		type: "method",
				// 		value: next_token().value,
				// 	})
				// }
			} else if (token.value == "!") {
				err("not available "+token.value)
				// const next = next_token()
				// if (next.type == "separator" && next.value == "(") {
				// 	push_to_build({
				// 		type: "assert",
				// 		value: next_token().value,
				// 	})
				// } else if (next.type == "operator" && next.value == "=") {
				// 	const past = build.pop()
	
				// 	if (!past) err("unexpected '!'")
	
				// 	push_to_build({
				// 		type: "notEquivalent",
				// 		left: [past],
				// 		right: [Modlite_compiler.parse(context, tokens, true)[0]],
				// 	})
				// } else {
				// 	push_to_build({
				// 		type: "assert",
				// 		value: next.value,
				// 	})
				// }
			}
		}

		else if (token.type == "operator") {

			// console.log("operator", token)

			const prior = build.pop()

			if (prior == undefined) err(token.value + " without left side")

			if (token.value == "+" || token.value == "-" || token.value == "*" || token.value == "/") {
				push_to_build({
					type: "operation",
					value: token.value,
					left: [prior],
					right: [Modlite_compiler.parse(context, tokens, true)[0]],
				})
			} else if (token.value == "=") {
				push_to_build({
					type: "assignment",
					left: [prior],
					right: [Modlite_compiler.parse(context, tokens, true)[0]],
				})
			} else if (token.value == "==") {
				const parse = Modlite_compiler.parse(context, tokens, true)
				push_to_build({
					type: "equivalent",
					left: [prior],
					right: [parse[0]],
				})
			} else if (token.value == "!=") {
				const parse = Modlite_compiler.parse(context, tokens, true)
				push_to_build({
					type: "notEquivalent",
					left: [prior],
					right: [parse[0]],
				})
			} else if (token.value == "..") {
				const parse = Modlite_compiler.parse(context, tokens, true)
				push_to_build({
					type: "join",
					left: [prior],
					right: [parse[0]],
				})
			}
		}

		else if (token.type == "string") {

			// console.log("string", token)

			push_to_build({
				type: "string",
				value: token.value,
			})
		}

		else if (token.type == "number") {

			// console.log("number", token)

			push_to_build({
				type: "number",
				value: token.value,
			})
		}

		if (inExpression) {
			// console.log("inExpression end?", tokens[context.i-1], tokens[context.i])

			// mess
			if (tokens[context.i] && tokens[context.i].type == "separator" && tokens[context.i].value == "(") {
				// do nothing
			} else {
				if (!tokens[context.i]) {
					// console.log("end1")
					return build
				}

				if (tokens[context.i-1].type != "operator" && tokens[context.i].type != "operator") {
					// console.log("end2")
					return build
				}
			}

			// console.log("continue")
		}
	}

	function get_token(int) {
		if (!int) int = 0
		const token = tokens[context.i+int];
		return token
	}

	// get the next token and increment context.i
	function next_token() {
		const token = tokens[context.i++];
		// console.log("next_token", token)
		return token
	}

	function back_token() {
		context.i--
	}

	function read_until(func) {
		var past = []
		while (true) {
			const token = next_token()
			if (!token) err("read_until never ended")
			if (func(token)) {
				return past
			} else {
				past.push(token)
			}
		}
	}

	function push_to_build(obj) {
		if (!obj.lineNumber) obj.lineNumber = tokens[context.i-1].lineNumber
		build.push(obj)
	}

	function parse_function(token, isPublic) {
		const name = next_token()

		let args = []

		// eat the "("
		next_token()
		// read until the ")"
		const argument_tokens = read_until((token) => {
			return token.type == "separator" && token.value == ")"
		})

		for (let index = 0; index < argument_tokens.length; index++) {
			const argument_token = argument_tokens[index];
			if (argument_token.type == "separator" && argument_token.value == ":") {
				args.push({
					name: argument_tokens[index-1].value,
					type: argument_tokens[index+1].value,
				})
			}
		}

		const Return = next_token()
		if (Return.type != "word") err("return must be a word")

		// eat the "{"
		next_token()

		const statement = Modlite_compiler.parse(context, tokens, false)

		push_to_build({
			type: "function",
			public: isPublic,
			name: name.value,
			args: args,
			return: Return.value,
			value: statement,
			lineNumber: token.lineNumber,
		})
	}

	function parse_var(token, isPublic) {
		const name = next_token()

		const type = next_token()

		push_to_build({
			type: "definition",
			public: isPublic,
			name: name.value,
			variableType: type.value,
			lineNumber: token.lineNumber,
		})
	}

	function parse_import() {
		next_token()
		const parse = Modlite_compiler.parse(context, tokens, false)

		const from = next_token()

		if (from.type != "word") err("expected the word 'from'")
		if (from.value != "from") err("expected the word 'from'")

		const string = next_token()
		if (string.type != "string") err("expected string")

		let imports = []
		for (let index = 0; index < parse.length; index++) {
			const thing = parse[index];
			if (thing.type != "var") err("only words are allowed inside of an import statement")

			const next = parse[index+1]
			if (thing.type != "var") err("only words are allowed inside of an import statement")

			if (next && next.value == "as") {
				index += 2
				imports.push([thing.value, parse[index].value])
			} else {
				imports.push([thing.value, thing.value])
			}
		}

		push_to_build({
			type: "import",
			imports: imports,
			path: string.value,
		})
	}

	function parse_if() {
		next_token()
		const condition = Modlite_compiler.parse(context, tokens, false)
		next_token()
		const trueStatement = Modlite_compiler.parse(context, tokens, false)

		const elseWord = next_token()

		if (elseWord.type == "word" && elseWord.value == "else") {
			next_token()
			const falseStatement = Modlite_compiler.parse(context, tokens, false)
			push_to_build({
				type: "if_else",
				condition: condition,
				trueStatement: trueStatement,
				falseStatement: falseStatement,
			})
		} else {
			back_token()
			push_to_build({
				type: "if",
				condition: condition,
				trueStatement: trueStatement,
			})
		}
	}

	function parse_switch() {
		next_token()
		const statements = Modlite_compiler.parse(context, tokens, false)

		push_to_build({
			type: "switch",
			statements: statements,
		})
	}

	function parse_while() {
		next_token()
		const condition = Modlite_compiler.parse(context, tokens, false)
		next_token()
		const statement = Modlite_compiler.parse(context, tokens, false)

		push_to_build({
			type: "while",
			condition: condition,
			statement: statement
		})
	}

	function parse_return() {
		const statement = Modlite_compiler.parse(context, tokens, true)

		push_to_build({
			type: "return",
			statement: statement
		})
	}

	function err(msg) {
		Modlite_compiler.handle_error(msg, tokens[context.i-1].lineNumber, context.level)
		throw "[parser error]";
	}

	context.level--
	return build
}

Modlite_compiler.handle_error = (error, lineNumber, level) => {
    const lines = Modlite_compiler.string.split("\n")
    let msg = `${error} at line ${lineNumber}\n`

    if (lines[lineNumber-4] != undefined) msg += getLineNumber(lineNumber-3) + " | "       + removeSpacesOrTabsAtStart(lines[lineNumber-4]) + "\n"
    if (lines[lineNumber-3] != undefined) msg += getLineNumber(lineNumber-2) + " | "       + removeSpacesOrTabsAtStart(lines[lineNumber-3]) + "\n"
    if (lines[lineNumber-2] != undefined) msg += getLineNumber(lineNumber-1) + " | "       + removeSpacesOrTabsAtStart(lines[lineNumber-2]) + "\n"
    if (lines[lineNumber-1] != undefined) msg += getLineNumber(lineNumber  ) + " | =->    " + removeSpacesOrTabsAtStart(lines[lineNumber-1]) + "\n"
    if (lines[lineNumber  ] != undefined) msg += getLineNumber(lineNumber+1) + " | "       + removeSpacesOrTabsAtStart(lines[lineNumber  ]) + "\n"
    if (lines[lineNumber+1] != undefined) msg += getLineNumber(lineNumber+2) + " | "       + removeSpacesOrTabsAtStart(lines[lineNumber+1]) + "\n"
    if (lines[lineNumber+2] != undefined) msg += getLineNumber(lineNumber+3) + " | "       + removeSpacesOrTabsAtStart(lines[lineNumber+2]) + "\n"

    if (level) msg += ` at level ${level}\n`
    msg += `version: ${Modlite_compiler.version}`
    console.error(msg)

    function getLineNumber(lineNumber_in) {
        let lineNumberStr = `${lineNumber_in}`
        if (lineNumber+4 > 10 && lineNumberStr.length < 2) {
            lineNumberStr = "0" + lineNumberStr
        }
        if (lineNumber+4 > 100 && lineNumberStr.length < 3) {
            lineNumberStr = "0" + lineNumberStr
        }
        return lineNumberStr
    }

    // I can't figure out how to do this in regular expressions
    function removeSpacesOrTabsAtStart(string) {
        let newString = ""
        let foundChar = false
        for (let i = 0; i < string.length; i++) {
            if (!foundChar && (string[i] == " " || string[i] == "\t")) continue
             
            newString += string[i]
            foundChar = true
        }
        return newString
    }
}

Modlite_compiler.assemblyToOperationCode = (assembly) => {
	let index = 0
	let opCode = ""
	let locations = {}
	while (index < assembly.length) {
		const instruction = assembly[index];
		
		if (instruction.startsWith("@")) {
			if (!locations[instruction.slice(1, instruction.length)]) locations[instruction.slice(1, instruction.length)] = {
				position: 0,
				references: []
			}
			locations[instruction.slice(1, instruction.length)].position = opCode.length
		} else if (instruction == "push") {
			opCode += Modlite_compiler.binaryCodes.push + getNextInstruction() + Modlite_compiler.binaryCodes.break
		} else if (instruction == "pop") {
			opCode += Modlite_compiler.binaryCodes.pop + getNextInstruction() + Modlite_compiler.binaryCodes.break
		} else if (instruction == "addRegisters") {
			opCode += Modlite_compiler.binaryCodes.addRegisters + getNextInstruction() + Modlite_compiler.binaryCodes.break
		} else if (instruction == "removeRegisters") {
			opCode += Modlite_compiler.binaryCodes.removeRegisters + getNextInstruction() + Modlite_compiler.binaryCodes.break
		} else if (instruction == "set") {
			opCode += Modlite_compiler.binaryCodes.set + getNextInstruction() + Modlite_compiler.binaryCodes.break
		} else if (instruction == "get") {
			opCode += Modlite_compiler.binaryCodes.get + getNextInstruction() + Modlite_compiler.binaryCodes.break
		} else if (instruction == "setGlobal") {
			opCode += Modlite_compiler.binaryCodes.setGlobal + getNextInstruction() + Modlite_compiler.binaryCodes.break
		} else if (instruction == "getGlobal") {
			opCode += Modlite_compiler.binaryCodes.getGlobal + getNextInstruction() + Modlite_compiler.binaryCodes.break
		} else if (instruction == "jump") {
			opCode += Modlite_compiler.binaryCodes.jump
		} else if (instruction == "conditionalJump") {
			opCode += Modlite_compiler.binaryCodes.conditionalJump
		} else if (instruction == "notConditionalJump") {
			opCode += Modlite_compiler.binaryCodes.notConditionalJump
		} else if (instruction == "externalJump") {
			opCode += Modlite_compiler.binaryCodes.externalJump
		} else if (instruction == "add") {
			opCode += Modlite_compiler.binaryCodes.add
		} else if (instruction == "subtract") {
			opCode += Modlite_compiler.binaryCodes.subtract
		} else if (instruction == "multiply") {
			opCode += Modlite_compiler.binaryCodes.multiply
		} else if (instruction == "divide") {
			opCode += Modlite_compiler.binaryCodes.divide
		} else if (instruction == "equivalent") {
			opCode += Modlite_compiler.binaryCodes.equivalent
		} else if (instruction == "join") {
			opCode += Modlite_compiler.binaryCodes.join
		} else if (instruction == "not") {
			opCode += Modlite_compiler.binaryCodes.not
		} else if (instruction == "\n") {

		} else {
			throw "unknown assembly instruction " + instruction
		}

		index++
	}

	if (logEverything) console.log("locations", JSON.stringify(locations, null, 2), "\n")

	let temp = opCode.split("")

	for (const key in locations) {
		const location = locations[key]

		for (let i = 0; i < location.references.length; i++) {
			const reference = location.references[i]
			temp[reference] = getCharacter(String(location.position))
		}
	}

	return temp.join("")

	function getNextInstruction() {
		index++
		const instruction = assembly[index]

		if (instruction.startsWith("*")) {
			if (!locations[instruction.slice(1, instruction.length)]) locations[instruction.slice(1, instruction.length)] = {
				position: 0,
				references: []
			}
			locations[instruction.slice(1, instruction.length)].references.push(opCode.length + 1)
			return "*"
		}

		return instruction
	}

	function getCharacter(string) {
		return string.split(' ').map(char => String.fromCharCode(parseInt(char, 10))).join('');
	}
}

// --------

import fs from "fs"
import { join, dirname } from "path"
import crypto from "crypto"

const rootPath = process.argv[2]

if (!rootPath) throw "no path specified"

const logEverything = process.argv.includes("--log")

const testBuild = process.argv.includes("--test")

// const debugBuild = process.argv.includes("--debug")

if (logEverything) console.log("process.argv", process.argv)

Modlite_compiler.compileCode = (rootPath) => {
	const jsonString = fs.readFileSync(join(rootPath, "conf.json"), "utf8")

	const conf = JSON.parse(jsonString)

	if (logEverything) console.log(`conf: ${JSON.stringify(conf, null, 2)}\n`)

	if (!conf.entry) throw "no entry in conf"
	if (!conf.entry.endsWith(".modlite")) throw "entry must end with .modlite"

	if (!conf.saveTo) throw "no saveTo in conf"

	try {
		let context = {
			rootPath: rootPath,
			globalCount: 1,
			uniqueIdentifierCounter: 0,
			testCounter: 1,

			startAssembly: [
				"push", "*" + conf.entry + " main", "\n",
				"jump", "\n",
			],
			// testAssembly: [],
			mainAssembly: [],
		}
		let assembly = []
		let files = {}
		Modlite_compiler.getAssembly(conf.entry, context, files, true)
		if (logEverything) console.log("files:\n", JSON.stringify(files) + "\n")
		// if (testBuild) {
		// 	if (files[conf.entry].main && files[conf.entry].main.type == "function") {
		// 		assembly.push("push", "*startEnd", "\n")
		// 		assembly.push(...context.startAssembly)
		// 		assembly.push("@startEnd", "\n")
		// 	}
		// 	assembly.push(...context.testAssembly)
		// 	assembly.push("jump", "\n")
		// } else {
		// 	assembly.push(...context.startAssembly)
		// }
		assembly.push(...context.startAssembly)
		assembly.push(...context.mainAssembly)
		if (logEverything) console.log("assembly:\n " + assembly.join(" ") + "\n")

		const opCode = Modlite_compiler.assemblyToOperationCode(assembly)
		if (logEverything) console.log("opCode:\n" + opCode + "\n")

		// save the opCode to a file in the rootPath
		fs.writeFile(join(rootPath, conf.saveTo), opCode, function (err) {
			if (err) throw err
			if (testBuild) {
				console.log("test build saved to " + join(rootPath, conf.saveTo))
			} else {
				console.log("saved to " + join(rootPath, conf.saveTo))
			}
		});
	} catch (error) {
		if (error != "[lexar error]" && error != "[parser error]" && error != "[getAssembly error]") throw error
		return
	}
}

Modlite_compiler.getAssembly = (path, context, files, main) => {
	const text = fs.readFileSync(join(context.rootPath, path), "utf8")
	if (logEverything) console.log(`------- ${join(context.rootPath, path)} -------\n${text}\n`)

	const tokens = Modlite_compiler.lex(text)
	if (logEverything) console.log("tokens:\n" + JSON.stringify(tokens, null) + "\n")

	const build_in = Modlite_compiler.parse({ lineNumber: 1, level: -1, i: 0 }, tokens, false)
	if (logEverything) console.log("build:\n" + JSON.stringify(build_in, null, 2) + "\n")

	let level = -1
	let lineNumber = 0
	let variables = [{}]

	files[path] = {}

	for (let index = 0; index < build_in.length; index++) {
		const thing = build_in[index];
		if (thing.lineNumber) lineNumber = thing.lineNumber

		if (thing.type != "function" && thing.type != "import" && thing.type != "definition" && thing.type != "test") err("not a function or import or definition or test at top level")

		// if (!main && thing.type == "definition") err("global definitions must be in top level of the main file")
	}

	assemblyLoop(context.mainAssembly, build_in, true, false, "normal")

	function assemblyLoop(assembly, build, newScope, expectValues, buildType) {
		if (newScope) {
			level++
			if (!variables[level]) variables[level] = {}
		}

		const endId = crypto.randomUUID()

		//
		// pre loop
		//

		for (let index = 0; index < build.length; index++) {
			const thing = build[index];
			if (thing.lineNumber) lineNumber = thing.lineNumber
	
			if (thing.type == "function") {
				if (level != 0) err("functions can only be defined at top level")
				if (variables[0][thing.name]) err(`variable ${thing.name} already exists`)
		
				variables[0][thing.name] = {
					type: "function",
					public: thing.public,
					ID: path + " " + thing.name,
					args: thing.args,
					return: thing.return,
				}
				files[path][thing.name] = variables[0][thing.name]
			} else if (thing.type == "import") {
				if (thing.path.endsWith(".modlite")) {
					if (!files[thing.path]) {
						Modlite_compiler.getAssembly(thing.path, context, files, false)
					}
					for (let i = 0; i < thing.imports.length; i++) {
						const importName = thing.imports[i][0];
						const newName = thing.imports[i][1];
	
						if (!files[thing.path][importName]) err(`import ${importName} from modlite file ${thing.path} not found`)

						if (!files[thing.path][importName].public) err(`import ${importName} from modlite file ${thing.path} is not public`)

						if (variables[0][newName]) err(`Import with name ${newName} failed. Because a variable named ${newName} already exists.`)
	
						variables[0][newName] = files[thing.path][importName]
					}
				} else if (thing.path.endsWith(".json")) {
					let jsonString = fs.readFileSync(join(context.rootPath, thing.path), "utf8")
	
					const json = JSON.parse(jsonString)
	
					for (let i = 0; i < thing.imports.length; i++) {
						const importName = thing.imports[i][0];
						const newName = thing.imports[i][1];
						
						if (!json[importName]) err(`import ${importName} from json file ${thing.path} not found`)
	
						if (variables[0][newName]) err(`Import with name ${newName} failed. Because a variable named ${newName} already exists.`)
	
						variables[0][newName] = json[importName]
					}
				} else {
					if (thing.path == "StandardLibrary") {
						let jsonString = fs.readFileSync(join(dirname(process.argv[1]), thing.path+".json"), "utf8")
		
						const json = JSON.parse(jsonString)
		
						for (let i = 0; i < thing.imports.length; i++) {
							const importName = thing.imports[i][0];
							const newName = thing.imports[i][1];
							
							if (!json[importName]) err(`import ${importName} from json file ${thing.path} not found`)
		
							if (variables[0][newName]) err(`Import with name ${newName} failed. Because a variable named ${newName} already exists.`)
		
							variables[0][newName] = json[importName]
						}
					} else {
						err(`'${thing.path}' does not have a valid file extension`)
					}

				}
			}
		}

		if (newScope && level != 0) {
			pushToAssembly(["addRegisters", String(getRegisterRequirement())])
		}
		
		//
		// main loop
		//

		for (let index = 0; index < build.length; index++) {
			const thing = build[index];
			if (thing.lineNumber) lineNumber = thing.lineNumber
			
			if (thing.type == "function") {
				const variable = getVariable(thing.name)
				variables[level+1] = {}

				for (let i = 0; i < thing.args.length; i++) {
					const arg = thing.args[i];
					variables[level+1][arg.name] = {
						type: arg.type,
						index: -1-i,
					}
				}

				pushToAssembly([`@${variable.ID}`])
				
				if (buildType == "debug") debugLog(`in function ${thing.name} ID: ${variable.ID} (${thing.lineNumber})`)

				assemblyLoop(assembly, thing.value, true, false, buildType)
				if (variables[0][thing.name].args.length > 0) pushToAssembly(["pop", String(variables[0][thing.name].args.length)])
				pushToAssembly(["jump"])
			}
			
			else if (thing.type == "string" || thing.type == "number") {
				if (!expectValues) err(`unexpected ${thing.type}`)

				pushToAssembly(["push", String(thing.value)])
			}
			
			else if (thing.type == "bool") {
				if (!expectValues) err(`unexpected ${thing.type}`)

				pushToAssembly(["push", thing.value == true ? "1" : "0"])
			}

			else if (thing.type == "definition") {
				if (Modlite_compiler.reservedWords.includes(thing.name)) err(`${thing.name} is a reserved word`)
				if (level == 0) {
					variables[level][thing.name] = {
						type: thing.variableType,
						index: context.globalCount++,
						global: true,
						public: thing.public,
						initialized: false,
					}
					files[path][thing.name] = variables[level][thing.name]
				} else {
					variables[level][thing.name] = {
						type: thing.variableType,
						index: getRegisterRequirement(),
						global: false,
						initialized: false,
					}
				}
			}

			else if (thing.type == "assignment") {
				const variable = getVariable(thing.left[0].value)
				if (!variable) err(`variable ${thing.left[0].value} does not exist`)

				assemblyLoop(assembly, thing.right, false, true, buildType)
				if (variable.global) {
					pushToAssembly(["setGlobal", String(variable.index)])
				} else {
					pushToAssembly(["set", String(variable.index)])
				}

				variable.initialized = true
			}
			
			// get a variable `print(a)`
			//                       ^
			else if (thing.type == "var") {
				if (!expectValues) err(`unexpected ${thing.type}`)

				const variable = getVariable(thing.value)
				if (!variable) err("variable " + thing.value + " does not exist")
				// if (variable.initialized == false) err("variable " + thing.value + " not initialized")

				if (variable.type == "function") {
					pushToAssembly(["push", "*" + variable.ID])
				} else {
					if (variable.global) {
						pushToAssembly(["getGlobal", String(variable.index)])
					} else {
						pushToAssembly(["get", String(variable.index)])
					}
				}
			}
			
			else if (thing.type == "call") {
				if (Modlite_compiler.reservedWords.includes(thing.name)) err(`${thing.name} is a reserved word`)

				const variable = getVariable(thing.name)

				if (!variable) err(`(call) variable ${thing.name} does not exist`)

				if (variable.type != "function" && variable.type != "exposedFunction") err(`variable ${thing.name} is not a function`)

				checkArguments(thing.name, thing.args, variable.args)

				if (buildType == "debug") debugLog(`call ${variable.type} ID: ${variable.ID} (${thing.lineNumber})`)

				if (variable.type == "exposedFunction") {
					assemblyLoop(assembly, thing.args, false, true, buildType)
					pushToAssembly(["push", variable.ID])
					pushToAssembly(["externalJump"])
				} else {
					const return_location = "return_location" + context.uniqueIdentifierCounter++
					pushToAssembly(["push", "*" + return_location])
					assemblyLoop(assembly, thing.args, false, true, buildType)
					pushToAssembly(["push", "*" + variable.ID])
					pushToAssembly(["jump"])
					pushToAssembly(["@" + return_location])
				}

				if (variable.type == "function" && variable.return != "void" && expectValues) {
					pushToAssembly(["getGlobal", "0"])
				}

				// if the exposedFunction returns something pop the return value off because it is not being used
				if (variable.type == "exposedFunction" && variable.return != "void" && !expectValues) {
					pushToAssembly(["pop", "1"])
				}
			}

			else if (thing.type == "operation") {
				assemblyLoop(assembly, thing.left, false, true, buildType)
				assemblyLoop(assembly, thing.right, false, true, buildType)
				if (thing.value == "+") {
					pushToAssembly(["add"])
				} else if (thing.value == "-") {
					pushToAssembly(["subtract"])
				} else if (thing.value == "*") {
					pushToAssembly(["multiply"])
				} else if (thing.value == "/") {
					pushToAssembly(["divide"])
				}
			}


			else if (thing.type == "equivalent") {
				assemblyLoop(assembly, thing.left, false, true, buildType)
				assemblyLoop(assembly, thing.right, false, true, buildType)
				pushToAssembly(["equivalent"])
			}

			else if (thing.type == "notEquivalent") {
				assemblyLoop(assembly, thing.left, false, true, buildType)
				assemblyLoop(assembly, thing.right, false, true, buildType)
				pushToAssembly(["equivalent"])
				pushToAssembly(["not"])
			}

			else if (thing.type == "join") {
				assemblyLoop(assembly, thing.left, false, true, buildType)
				assemblyLoop(assembly, thing.right, false, true, buildType)
				pushToAssembly(["join"])
			}

			else if (thing.type == "if") {
				const if_jump = "if_jump" + context.uniqueIdentifierCounter++

				assemblyLoop(assembly, thing.condition, false, true, buildType)
				pushToAssembly(["push", "*" + if_jump])
				pushToAssembly(["notConditionalJump"])
				assemblyLoop(assembly, thing.trueStatement, false, false, buildType)
				pushToAssembly(["@" + if_jump])
			}

			else if (thing.type == "if_else") {
				const if_else_true = "if_else_true" + context.uniqueIdentifierCounter++
				const if_else_end = "if_else_end" + context.uniqueIdentifierCounter++

				assemblyLoop(assembly, thing.condition, false, true, buildType)
				pushToAssembly(["push", "*" + if_else_true])
				pushToAssembly(["conditionalJump"])

				assemblyLoop(assembly, thing.falseStatement, false, false, buildType)
				pushToAssembly(["push", "*" + if_else_end])
				pushToAssembly(["jump"])

				pushToAssembly(["@" + if_else_true])
				assemblyLoop(assembly, thing.trueStatement, false, false, buildType)

				pushToAssembly(["@" + if_else_end])
			}

			else if (thing.type == "switch") {
				const switch_end = "switch_end" + context.uniqueIdentifierCounter++

				for (let index = 0; index < thing.statements.length; index++) {
					const Case = thing.statements[index];
					if (Case.lineNumber) lineNumber = Case.lineNumber
					
					if (Case.type != "case") err("not a case")

					const switch_over = "switch_over" + index + " " + context.uniqueIdentifierCounter++

					assemblyLoop(assembly, Case.condition, false, true, buildType)

					pushToAssembly(["push", "*" + switch_over])
					pushToAssembly(["notConditionalJump"])

					assemblyLoop(assembly, Case.statement, false, true, buildType)

					pushToAssembly(["push", "*" + switch_end])
					pushToAssembly(["jump"])

					pushToAssembly(["@" + switch_over])
				}

				pushToAssembly(["@" + switch_end])
			}

			else if (thing.type == "while") {
				const while_top = "while_top" + context.uniqueIdentifierCounter++
				const while_bottom = "while_bottom_id" + context.uniqueIdentifierCounter++

				pushToAssembly(["push", "*" + while_bottom])
				pushToAssembly(["jump"])


				pushToAssembly(["@" + while_top])
				assemblyLoop(assembly, thing.statement, false, true, buildType)


				pushToAssembly(["@" + while_bottom])
				assemblyLoop(assembly, thing.condition, false, true, buildType)
				pushToAssembly(["push", "*" + while_top])
				pushToAssembly(["conditionalJump"])
			}

			else if (thing.type == "return") {
				assemblyLoop(assembly, thing.statement, false, true, buildType)
				pushToAssembly(["setGlobal", "0"])
				// for now just jump to the end of the function
				pushToAssembly(["push", "*end " + endId])
				pushToAssembly(["jump"])
			}

			else if (thing.type == "case") {
				err("unexpected case")
			}

			else if (thing.type == "compilerSetting") {
				if (thing.name == "duplicate") {
					for (let index = 0; index < thing.args[0]; index++) {
						assemblyLoop(assembly, thing.build, false, true, buildType)
					}
				} else if (thing.name == "debug") {
					debugLog(`debug mode enabled (${thing.lineNumber})`)
					assemblyLoop(assembly, thing.build, false, true, "debug")
					debugLog(`debug mode disabled (${thing.lineNumber})`)
				} else if (thing.name == "optimize") {
					assemblyLoop(assembly, thing.build, false, true, "optimize")
				}
			}
		}

		if (newScope) {
			if (level != 0) {
				pushToAssembly(["@" + "end " + endId])
				pushToAssembly(["removeRegisters", String(getRegisterRequirement())])
			}

			delete variables[level]
			level--
		}

		function pushToAssembly(data) {
			assembly.push(...data, "\n")
		}

		function debugLog(msg) {
			pushToAssembly(["push", "[debug] "+msg])
			pushToAssembly(["push", "MLSL:print"])
			pushToAssembly(["externalJump"])
		}
	}

	function getVariable(name) {
		for (let i = 0; i < variables.length; i++) {
			if (variables[i][name]) return variables[i][name]
		}
	}

	// function setVariable(name, value) {
	// 	for (let i = 0; i < variables.length; i++) {
	// 		if (variables[i][name]) variables[i][name] = value
	// 	}
	// }

	function getRegisterRequirement() {
		let count = 0
		for (const key in variables[level]) {
			if (variables[level][key].index > 0) {
				count++
			}
		}

		return count
	}

	function getGlobalAmount() {
		let count = 0
		for (const key in variables[level]) {
			if (variables[level][key].global) {
				count++
			}
		}

		return count
	}

	function checkArguments(name, actualArguments, expectedArguments) {

		if (actualArguments.length > expectedArguments.length) err(`too many arguments for ${name} requires ${expectedArguments.length}`)
		if (actualArguments.length < expectedArguments.length) err(`not enough arguments for ${name} requires ${expectedArguments.length}`)

		for (let i = 0; i < actualArguments.length; i++) {
			const expectedArgument = expectedArguments[i];
			let actualArgument = actualArguments[i];

			// if this argument can take anything just continue
			if (expectedArgument.type == "any") continue

			if (actualArgument.type == "var") {
				const varArg = getVariable(actualArgument.value)
				if (!varArg) err(`(arg var) variable ${actualArgument.value} does not exist`)
				actualArgument = varArg
			} else if (actualArgument.type == "call") {
				const varArg = getVariable(actualArgument.name)
				if (!varArg) err(`(arg call) variable ${actualArgument.name} does not exist`)
				actualArgument = {
					type: varArg.return
				}
			} else if (actualArgument.type == "join") {
				actualArgument = {
					type: "string"
				}
			} else if (actualArgument.type == "operation") {
				actualArgument = {
					type: "number"
				}
			}

			if (actualArgument.type != expectedArgument.type) err(`${name} argument ${i+1} expected type ${expectedArgument.type} but got type ${actualArgument.type}`)

			if (expectedArgument.type == "function") {
				checkArguments("internal_function" + (i+1), actualArgument.args, expectedArgument.args)
			}
		}
	}

	function err(msg) {
		Modlite_compiler.handle_error(msg, lineNumber, level)
		throw "[getAssembly error]";
	}
}

Modlite_compiler.compileCode(rootPath)