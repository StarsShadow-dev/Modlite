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
		"class",
		"var",
	],
	
	binaryCodes: {

		//
		// stack management
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
		// jumping
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
		// high-level data storage
		//
	
		createTable: "m",
		removeTable: "n",
		setTable: "o",
		getTable: "p",
	
		//
		// math
		//
	
		add: "q",
		subtract: "r",
		multiply: "s",
		divide: "t",
	
		//
		// other
		//
		
		// check to see if two values are equivalent
		equivalent: "u",
		greaterThan: "v",
		// join to strings
		join: "w",
		// reverse a bool (true = false and false = true)
		not: "x",
		and: "y",
		or: "z",
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
							} else if (loop_char == "r") {
								past += "\r"
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

		else if (char.match(/[\(\)\{\}\[\]\:]/)) {
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

Modlite_compiler.parse = (context, tokens, inExpression, end) => {
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
					parse_definition(next, true)
				} else if (next.value == "class") {
					parse_class(next, true)
				} else {
					err("unexpected 'public' keyword")
				}
			} else if (token.value == "function") {
				parse_function(token, false)
			} else if (token.value == "var") {
				parse_definition(token, false)
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
			} else if (token.value == "class") {
				parse_class(token, false)
			} else {
				push_to_build({
					type: "word",
					value: token.value,
				})
			}
		}

		else if (token.type == "compilerSetting") {
			if (token.value[0] == "end") {
				if (end != "@end") err("expected " + end)
				return build
			}
			const parse = Modlite_compiler.parse(context, tokens, false, "@end")

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
	
				if (!past) err("unexpected `(`")
				if (past.type != "word") err("expected word before `(`")
	
				if (past.value == "case") {
					const condition = Modlite_compiler.parse(context, tokens, false, ")")
					next_token()
					const codeBlock = Modlite_compiler.parse(context, tokens, false, "}")
	
					push_to_build({
						type: "case",
						condition: condition,
						codeBlock: codeBlock
					})
				} else {
					push_to_build({
						type: "call",
						name: past,
						args: Modlite_compiler.parse(context, tokens, false, ")"),
					})
				}
			} else if (token.value == ")") {
				if (end != token.value) err(`expected ${end} got ${token.value}`)
				return build
			} else if (token.value == "{") {
				err("unexpected {")
			} else if (token.value == "}") {
				if (end != token.value) err(`expected ${end} got ${token.value}`)
				return build
			} else if (token.value == "[") {
				const prior = build.pop()

				if (prior) {
					if (prior.type != "word") err("memberAccess expected word before `[`")

					const memberAccess = Modlite_compiler.parse(context, tokens, false)

					push_to_build({
						type: "memberAccess",
						left: [prior],
						right: memberAccess,
					})
				} else {
					const value = Modlite_compiler.parse(context, tokens, false, "]")

					push_to_build({
						type: "table",
						value: value,
					})
				}
			} else if (token.value == "]") {
				if (end != token.value) err(`expected ${end} got ${token.value}`)
				return build
			} else if (token.value == "!") {
				err("separator not available " + token.value)
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
			} else if (token.value == ".") {
				const next = next_token()

				if (next.type != "word") err("memberAccess expected word before `.`")

				push_to_build({
					type: "memberAccess",
					left: [prior],
					right: [{
						type: "string",
						value: next.value,
					}],
				})
			} else if (token.value == "..") {
				const parse = Modlite_compiler.parse(context, tokens, true)
				push_to_build({
					type: "join",
					left: [prior],
					right: [parse[0]],
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
			} else if (token.value == ">") {
				const parse = Modlite_compiler.parse(context, tokens, true)
				push_to_build({
					type: "greaterThan",
					left: [prior],
					right: [parse[0]],
				})
			} else if (token.value == "<") {
				const parse = Modlite_compiler.parse(context, tokens, true)
				push_to_build({
					type: "lessThan",
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
			// mess
			if (tokens[context.i] && tokens[context.i].type == "separator" && (tokens[context.i].value == "(" || tokens[context.i].value == "[")) {
				// do nothing
			} else {
				if (!tokens[context.i]) {
					return build
				}
	
				if (tokens[context.i-1].type != "operator" && tokens[context.i].type != "operator") {
					return build
				}	
			}
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
		if (Return.type != "word") err("functions must have a specified return type (if your function does not return anything specify `Void`)")

		// eat the "{"
		next_token()

		const codeBlock = Modlite_compiler.parse(context, tokens, false, "}")

		push_to_build({
			type: "function",
			public: isPublic,
			name: name.value,
			args: args,
			return: Return.value,
			codeBlock: codeBlock,
			lineNumber: token.lineNumber,
		})
	}

	function parse_definition(token, isPublic) {
		const name = next_token()

		const colon = next_token()

		if (colon.type != "separator" || colon.value != ":") err("expected colon as a separator between the name and type, example: `var myString:String`")

		const variableType = parse_type()

		// const type = next_token()

		push_to_build({
			type: "definition",
			public: isPublic,
			name: name.value,
			variableType: variableType,
			lineNumber: token.lineNumber,
		})
	}

	function parse_type() {
		while (true) {
			let variableType = next_token()
			// console.log("parse_type", variableType)

			if (variableType.type == "separator") {
				if (variableType.value == "[") {
					let newType = {
						type: "Table",
						value: parse_type(),
					}
					next_token()
					return newType
				} else if (variableType.value == "]") {
					err("tables must have an internal type")
				} else {
					err(variableType.value + " is not a valid separator for parse_type")
				}
			} else if (variableType.type == "word") {
				return {
					type: variableType.value,
				}
			} else {
				err("parse_type error variableType.type = " + variableType.type)
			}
		}
	}

	function parse_import() {
		next_token()
		const parse = Modlite_compiler.parse(context, tokens, false, "}")

		const from = next_token()

		if (from.type != "word" || from.value != "from") err("an import statement requires a location to get imports from, example: `import { print error } from \"StandardLibrary\"`")

		const string = next_token()
		if (string.type != "string") err("expected string")

		let imports = []
		for (let index = 0; index < parse.length; index++) {
			const thing = parse[index];
			if (thing.type != "word") err("only words are allowed inside of an import statement")

			const next = parse[index+1]
			if (thing.type != "word") err("only words are allowed inside of an import statement")

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
		const condition = Modlite_compiler.parse(context, tokens, false, ")")
		next_token()
		const trueCodeBlock = Modlite_compiler.parse(context, tokens, false, "}")

		const elseWord = next_token()

		if (elseWord && elseWord.type == "word" && elseWord.value == "else") {
			next_token()
			const falseCodeBlock = Modlite_compiler.parse(context, tokens, false, "}")
			push_to_build({
				type: "if",
				condition: condition,
				trueCodeBlock: trueCodeBlock,
				falseCodeBlock: falseCodeBlock,
			})
		} else {
			back_token()
			push_to_build({
				type: "if",
				condition: condition,
				trueCodeBlock: trueCodeBlock,
			})
		}
	}

	function parse_switch() {
		next_token()
		const codeBlock = Modlite_compiler.parse(context, tokens, false, "}")

		push_to_build({
			type: "switch",
			codeBlock: codeBlock,
		})
	}

	function parse_while() {
		next_token()
		const condition = Modlite_compiler.parse(context, tokens, false, ")")
		next_token()
		const codeBlock = Modlite_compiler.parse(context, tokens, false, "}")

		push_to_build({
			type: "while",
			condition: condition,
			codeBlock: codeBlock
		})
	}

	function parse_return() {
		let expression = Modlite_compiler.parse(context, tokens, true)

		if (expression.length == 0) err("return statements must always have a return value or `Void`")

		push_to_build({
			type: "return",
			expression: expression
		})
	}

	function parse_class(token, isPublic) {
		let name = next_token()

		if (!name || name.type != "word") err("expected name of class")

		next_token()
		const value = Modlite_compiler.parse(context, tokens, false, "}")

		push_to_build({
			type: "class",
			public: isPublic,
			name: name.value,
			value: value,
			lineNumber: token.lineNumber,
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
		}
		
		else if (
			instruction == "push" ||
			instruction == "pop" ||
			instruction == "addRegisters" ||
			instruction == "removeRegisters" ||
			instruction == "set" ||
			instruction == "get" ||
			instruction == "setGlobal" ||
			instruction == "getGlobal"
		) {
			opCode += Modlite_compiler.binaryCodes[instruction] + getNextInstruction() + Modlite_compiler.binaryCodes.break
		}
		
		else if (
			instruction == "jump" ||
			instruction == "conditionalJump" ||
			instruction == "notConditionalJump" ||
			instruction == "externalJump" ||
			instruction == "createTable" ||
			instruction == "removeTable" ||
			instruction == "setTable" ||
			instruction == "getTable" ||
			instruction == "add" ||
			instruction == "subtract" ||
			instruction == "multiply" ||
			instruction == "divide" ||
			instruction == "equivalent" ||
			instruction == "greaterThan" ||
			instruction == "join" ||
			instruction == "not"
		) {
			opCode += Modlite_compiler.binaryCodes[instruction]
		}
		
		else if (instruction == "\n") {}
		
		else {
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

			types: [],
			recursionHistory: [],

			functionId: undefined,
			expectedReturnType: undefined,
			setupAssembly: [
				"push", "", "\n"
			],
			startAssembly: [
				"push", "*end_of_program", "\n",
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
		assembly.push(...context.setupAssembly)
		if (files[conf.entry].main) {
			assembly.push(...context.startAssembly)
		} else {
			assembly.push(
				"push", "*end_of_program", "\n",
				"jump", "\n"
			)
		}

		assembly.push(...context.mainAssembly)
		assembly.push("@end_of_program")
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

	const build_in = Modlite_compiler.parse({ lineNumber: 1, level: -1, i: 0 }, tokens, false, undefined)
	if (logEverything) console.log("build:\n" + JSON.stringify(build_in, null) + "\n")

	let level = -1
	let lineNumber = 0
	let variables = [{}]
	let recursionHistory = []

	files[path] = {}

	for (let index = 0; index < build_in.length; index++) {
		const thing = build_in[index];
		if (thing.lineNumber) lineNumber = thing.lineNumber

		if (thing.type != "function" && thing.type != "import" && thing.type != "definition" && thing.type != "compilerSetting" && thing.type != "class") err("not a function, import, definition, compilerSetting or class at top level")
	}

	assemblyLoop(context.mainAssembly, build_in, "top", "normal", ["newScope"])

	// newScope
	function assemblyLoop(assembly, build, recursionName, buildType, flags) {

		if (recursionName) recursionHistory.push(recursionName)

		let types = []

		if (flags.includes("newScope")) {
			level++
			if (!variables[level]) variables[level] = {}
		}

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
					type: "Function",
					public: thing.public,
					ID: path + " " + thing.name,
					args: thing.args,
					return: thing.return,
				}
				files[path][thing.name] = variables[0][thing.name]
			}
			
			else if (thing.type == "class") {
				let data = {}
				let definitionCount = 0
				for (let i = 0; i < thing.value.length; i++) {
					const inClass = thing.value[i];
					if (inClass.type == "definition") {
						data[inClass.name] = {
							type: inClass.variableType,
							index: definitionCount++,
							initialized: false,
						}
					} else if (inClass.type == "function") {
						data[inClass.name] = {
							type: "function",
							ID: path + " class " + thing.name + " " + inClass.name,
							args: inClass.args,
							return: inClass.return,
						}
					} else {
						err(`unexpected ${inClass.type} in class, expected definition or function`)
					}
				}
				variables[0][thing.name] = {
					type: "class",
					public: thing.public,
					data: data,
				}
				files[path][thing.name] = variables[0][thing.name]
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

					// make sure that there is room on the stack for the global variable
					context.setupAssembly.push("push", "null", "\n")
				} else {
					variables[level][thing.name] = {
						type: thing.variableType,
						index: getRegisterRequirement(),
						global: false,
						initialized: false,
					}
				}
			}
			
			else if (thing.type == "import") {
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

		if (flags.includes("newScope") && level != 0) {
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
						global: false,
						initialized: true,
					}
				}
				context.functionId = variable.ID
				context.expectedReturnType = variable.return

				pushToAssembly([`@${variable.ID}`])
				
				if (buildType == "debug") debugLog(`in function ${thing.name} ID: ${variable.ID} (${thing.lineNumber})`)

				assemblyLoop(assembly, thing.codeBlock, "function", buildType, ["newScope"])
				if (variables[0][thing.name].args.length > 0) pushToAssembly(["pop", String(variables[0][thing.name].args.length)])
				pushToAssembly(["jump"])

				types.push(undefined)
			}

			else if (thing.type == "table") {
				pushToAssembly(["createTable"])

				types.push({type: "Table"})
			}

			else if (thing.type == "class") {
				for (let i = 0; i < thing.value.length; i++) {
					const inClass = thing.value[i];
					if (inClass.type == "function") {
						const method = variables[0][thing.name].data[inClass.name]

						context.functionId = method.ID
						context.expectedReturnType = method.return

						pushToAssembly([`@${method.ID}`])

						if (buildType == "debug") debugLog(`in function ${inClass.name} ID: ${method.ID} (${inClass.lineNumber})`)

						assemblyLoop(assembly, inClass.codeBlock, "class", buildType, [])
						if (method.args.length > 0) pushToAssembly(["pop", String(method.args.length)])
						pushToAssembly(["jump"])
					}
				}

				types.push({type: thing.name})
			}

			else if (thing.type == "memberAccess") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				const typelist = assemblyLoop(assembly, thing.left, "memberAccess", buildType, ["expectValues"])

				if (thing.left[0].type == "memberAccess") {
					assemblyLoop(assembly, thing.right, "memberAccess", buildType, ["expectValues"])
				} else {
					const variable = getVariable(typelist[0].type)

					if (variable && variable.type == "class") {
						if (!variable.data[thing.right[0]]) err(`class ${typelist[0].type} does not have a member named ${thing.right}`)

						pushToAssembly(["push", String(variable.data[thing.right].index)])
					} else {
						assemblyLoop(assembly, thing.right, "memberAccess", buildType, ["expectValues"])
					}
				}

				if (recursionHistory[recursionHistory.length-1] != "assignment_left") pushToAssembly(["getTable"])

				types.push(typelist[0])
			}
			
			else if (thing.type == "string") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				pushToAssembly(["push", String(thing.value)])

				types.push({type: "String"})
			}

			else if (thing.type == "number") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				pushToAssembly(["push", String(thing.value)])

				types.push({type: "Number"})
			}
			
			else if (thing.type == "bool") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				pushToAssembly(["push", thing.value == true ? "1" : "0"])

				types.push({type: "Bool"})
			}

			else if (thing.type == "assignment") {
				let variable

				let memberAccessTypelist

				if (thing.left[0].type == "word") {
					variable = getVariable(thing.left[0].value)
					if (!variable) err(`variable ${thing.left[0].value} does not exist`)
				} else if (thing.left[0].type == "memberAccess") {
					memberAccessTypelist = assemblyLoop(assembly, thing.left, "assignment_left", buildType, ["expectValues"])
				}

				const typelist = assemblyLoop(assembly, thing.right, "assignment_right", buildType, ["expectValues"])

				if (thing.left[0].type == "word") {
					checkType(variable.type, typelist[0])

					if (variable.global) {
						pushToAssembly(["setGlobal", String(variable.index)])
					} else {
						pushToAssembly(["set", String(variable.index)])
					}

					variable.initialized = true
				} else if (thing.left[0].type == "memberAccess") {
					checkType(memberAccessTypelist[0], typelist[0], thing.left)

					pushToAssembly(["setTable"])
				}

				types.push(undefined)
			}
			
			else if (thing.type == "word") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				const variable = getVariable(thing.value)
				if (!variable) err("variable " + thing.value + " does not exist")

				if (variable.type == "Function") {
					pushToAssembly(["push", "*" + variable.ID])

					types.push({type: variable.type})
				} else {
					if (variable.global) {
						pushToAssembly(["getGlobal", String(variable.index)])
					} else {
						if (!variable.initialized) err("variable " + thing.value + " not initialized")
						pushToAssembly(["get", String(variable.index)])
					}

					types.push(variable.type)
				}
			}
			
			else if (thing.type == "call") {
				let name
				let variable
				if (thing.name.type == "word") {
					name = thing.name.value
					variable = getVariable(name)
				} else if (thing.name.type == "memberAccess") {
					err("memberAccess call is not yet supported")
				}

				if (Modlite_compiler.reservedWords.includes(name)) err(`${name} is a reserved word`)

				if (!variable) err(`(call) variable ${name} does not exist`)

				if (variable.type == "Function" || variable.type == "ExposedFunction") {

					if (buildType == "debug") debugLog(`call ${variable.type} ID: ${variable.ID} (${thing.lineNumber})`)

					let typelist

					if (variable.type == "ExposedFunction") {
						typelist = assemblyLoop(assembly, thing.args, "call", buildType, ["expectValues"])
						pushToAssembly(["push", variable.ID])
						pushToAssembly(["externalJump"])
					} else {
						const return_location = "return_location" + context.uniqueIdentifierCounter++
						pushToAssembly(["push", "*" + return_location])
						typelist = assemblyLoop(assembly, thing.args, "call", buildType, ["expectValues"])
						pushToAssembly(["push", "*" + variable.ID])
						pushToAssembly(["jump"])
						pushToAssembly(["@" + return_location])
					}

					if (typelist.length > variable.args.length) err(`too many arguments for ${name} requires ${variable.args.length}`)
					if (typelist.length < variable.args.length) err(`not enough arguments for ${name} requires ${variable.args.length}`)

					for (let i = 0; i < typelist.length; i++) {
						const expectedArgument = variable.args[i];
						const actualType = typelist[i];
			
						// if this argument can take anything just continue
						if (expectedArgument.type == "Any") continue

						checkType(expectedArgument, actualType)
					}

					if (variable.type == "Function" && variable.return != "Void" && flags.includes("expectValues")) {
						pushToAssembly(["getGlobal", "0"])
					}

					// if the exposedFunction returns something pop the return value off because it is not being used
					if (variable.type == "ExposedFunction" && variable.return != "Void" && !flags.includes("expectValues")) {
						pushToAssembly(["pop", "1"])
					}

					types.push({type: variable.return})
				} else if (variable.type == "class") {
					pushToAssembly(["createTable"])

					types.push({type: name})
				} else {
					err(`variable ${name} is not a Function or class`)
				}
			}

			else if (thing.type == "operation") {
				assemblyLoop(assembly, thing.left, "operation", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "operation", buildType, ["expectValues"])
				if (thing.value == "+") {
					pushToAssembly(["add"])
				} else if (thing.value == "-") {
					pushToAssembly(["subtract"])
				} else if (thing.value == "*") {
					pushToAssembly(["multiply"])
				} else if (thing.value == "/") {
					pushToAssembly(["divide"])
				}

				types.push({type: "Number"})
			}


			else if (thing.type == "equivalent") {
				assemblyLoop(assembly, thing.left, "equivalent", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "equivalent", buildType, ["expectValues"])
				pushToAssembly(["equivalent"])

				types.push({type: "Bool"})
			}

			else if (thing.type == "notEquivalent") {
				assemblyLoop(assembly, thing.left, "notEquivalent", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "notEquivalent", buildType, ["expectValues"])
				pushToAssembly(["equivalent"])
				pushToAssembly(["not"])
				
				types.push({type: "Bool"})
			}

			else if (thing.type == "greaterThan") {
				assemblyLoop(assembly, thing.left, "greaterThan", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "greaterThan", buildType, ["expectValues"])
				pushToAssembly(["greaterThan"])

				types.push({type: "Bool"})
			}

			// lessThan is just greaterThan in reverse
			else if (thing.type == "lessThan") {
				assemblyLoop(assembly, thing.right, "lessThan", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.left, "lessThan", buildType, ["expectValues"])
				pushToAssembly(["greaterThan"])

				types.push({type: "Bool"})
			}

			else if (thing.type == "join") {
				assemblyLoop(assembly, thing.left, "join", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "join", buildType, ["expectValues"])
				pushToAssembly(["join"])

				types.push({type: "String"})
			}

			else if (thing.type == "if") {
				const if_true = "if_true" + context.uniqueIdentifierCounter++
				const if_end = "if_end" + context.uniqueIdentifierCounter++

				const typelist = assemblyLoop(assembly, thing.condition, "if", buildType, ["expectValues"])

				if (typelist.length != 1) err("if statements require 1 bool")
				if (typelist[0].type != "Bool") err(`if statement got type ${typelist[0].type} but expected type Bool`)

				if (thing.falseCodeBlock) {
					pushToAssembly(["push", "*" + if_true])
					pushToAssembly(["conditionalJump"])

					assemblyLoop(assembly, thing.falseCodeBlock, "if", buildType, [])
					pushToAssembly(["push", "*" + if_end])
					pushToAssembly(["jump"])

					pushToAssembly(["@" + if_true])
					assemblyLoop(assembly, thing.trueCodeBlock, "if", buildType, [])

					pushToAssembly(["@" + if_end])
				} else {
					pushToAssembly(["push", "*" + if_end])
					pushToAssembly(["notConditionalJump"])
					assemblyLoop(assembly, thing.trueCodeBlock, "if", buildType, [])
					pushToAssembly(["@" + if_end])
				}

				types.push(undefined)
			}

			else if (thing.type == "switch") {
				const switch_end = "switch_end" + context.uniqueIdentifierCounter++

				for (let index = 0; index < thing.codeBlock.length; index++) {
					const Case = thing.codeBlock[index];
					if (Case.lineNumber) lineNumber = Case.lineNumber
					
					if (Case.type != "case") err("not a case in switch statement")

					const switch_over = "switch_over" + index + " " + context.uniqueIdentifierCounter++

					assemblyLoop(assembly, Case.condition, "switch", buildType, ["expectValues"])

					pushToAssembly(["push", "*" + switch_over])
					pushToAssembly(["notConditionalJump"])

					assemblyLoop(assembly, Case.codeBlock, "switch", buildType, [])

					pushToAssembly(["push", "*" + switch_end])
					pushToAssembly(["jump"])

					pushToAssembly(["@" + switch_over])
				}

				pushToAssembly(["@" + switch_end])

				types.push(undefined)
			}

			else if (thing.type == "while") {
				const while_top = "while_top" + context.uniqueIdentifierCounter++
				const while_bottom = "while_bottom_id" + context.uniqueIdentifierCounter++

				pushToAssembly(["push", "*" + while_bottom])
				pushToAssembly(["jump"])


				pushToAssembly(["@" + while_top])
				assemblyLoop(assembly, thing.codeBlock, "while", buildType, [])


				pushToAssembly(["@" + while_bottom])
				assemblyLoop(assembly, thing.condition, "while", buildType, ["expectValues"])
				pushToAssembly(["push", "*" + while_top])
				pushToAssembly(["conditionalJump"])

				types.push(undefined)
			}

			else if (thing.type == "return") {
				let typelist
				if (thing.expression[0].type == "word" && thing.expression[0].value == "void") {
					typelist = ["void"]
				} else {
					typelist = assemblyLoop(assembly, thing.expression, "return", buildType, ["expectValues"])
				}

				if (typelist[0] != context.expectedReturnType) err(`expected return type ${context.expectedReturnType} got ${typelist[0]}`)

				if (thing.expression.length != 0 && context.expectedReturnType != "void") {
					pushToAssembly(["setGlobal", "0"])
				}
				// for now just jump to the end of the function
				pushToAssembly(["push", "*end " + context.functionId])
				pushToAssembly(["jump"])

				types.push(undefined)
			}

			else if (thing.type == "case") {
				err("case not in switch statement")
			}

			else if (thing.type == "compilerSetting") {
				if (thing.name == "duplicate") {
					for (let index = 0; index < thing.args[0]; index++) {
						assemblyLoop(assembly, thing.build, undefined, buildType, [])
					}
				} else if (thing.name == "debug") {
					assemblyLoop(assembly, thing.build, undefined, "debug", [])
				} else if (thing.name == "optimize") {
					assemblyLoop(assembly, thing.build, undefined, "optimize", [])
				}
			}
		}

		if (flags.includes("newScope")) {
			if (level != 0) {
				pushToAssembly(["@" + "end " + context.functionId])
				pushToAssembly(["removeRegisters", String(getRegisterRequirement())])
			}

			delete variables[level]
			level--
		}

		if (recursionName) recursionHistory.pop()

		return types

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

	function getRegisterRequirement() {
		let count = 0
		for (const key in variables[level]) {
			if (variables[level][key].index >= 0) {
				count++
			}
		}

		return count
	}

	function checkType(expected, actual, memberAccess) {
		// console.log("-------- checkType: --------")
		// console.log("expected", expected)
		// console.log("actual", actual)
		// console.log("memberAccess", JSON.stringify(memberAccess, null, 2))

		if (expected.type == "any") return

		if (memberAccess && expected.type == "Table") {

			if (memberAccess[0].type != "Table") {
				return
			}

			// console.log("in")
			checkType(expected.value, actual, memberAccess[0].left)
		} else {
			const variable = getVariable(expected.type)

			if (variable && variable.type == "class") {
				return
			}

			if (expected.type != actual.type) err(`expected type ${expected.type} but got type ${actual.type}`)
		}
	}

	function err(msg) {
		Modlite_compiler.handle_error(msg, lineNumber, level)
		throw "[getAssembly error]";
	}
}

Modlite_compiler.compileCode(rootPath)