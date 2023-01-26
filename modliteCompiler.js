// Modlite Rewrite 12

/* 
	A work in progress programming language.
	Currently compiles to a custom operation code and can run in JavaScript.
*/

// Modlite building environment
const Modlite_compiler = {
	version: "12.1",
	string: "",
	devlog: true,

	exposedVars: {},

	modules: {},

	// stuff for the lexar
	openString: /[\"\'\`]/,
	identifierStart: /[a-zA-Z\_]/,
	identifierNotEnd: /[a-zA-Z0-9\_]/,

	punctuation: /[\(\)\{\}\.\!\:]/,

	operator: /[\+\-\*\/\=]/,
	
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
		if (char && !char.match(/[ \n]/)) read_next(char)
	}

	function read_next(char) {

		// default with the regular expression /[a-zA-Z\_]/ ("a" to "z" || "A" to "Z" || "_")
		if (char.match(Modlite_compiler.identifierStart)) {
			handle_identifier()
		}

		else if (char.match(Modlite_compiler.openString)) {
			// startLine is only for the unexpected EOF (unexpected end of file) error
			const startLine = context.lineNumber
			handle_string(char)
			// if the lex ended with a string still active (probably because they forgot to end it) fail the lex
			if (!Modlite_compiler.string[context.i]) err(`unexpected EOF a string that started at line ${startLine} never ended`)
		}

		// if number
		else if (char.match(/[0-9]/)) {
			handle_number()
		}

		else if (char.match(Modlite_compiler.punctuation)) {
			handle_punctuation()
		}

		// if both characters are a slash that means a comment is happening
		else if (char == "/" && Modlite_compiler.string[context.i] == "/") {
			handle_comment()
		}

		/*
			for multiline comments like this
		*/
		else if (char == "/" && Modlite_compiler.string[context.i] == "*") {
			handle_multiline_comment()
		}

		else if (char.match(Modlite_compiler.operator)) {
			handle_operator()
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

	function handle_identifier() {
		back_char()
		const name = read_while((char) => {return char.match(Modlite_compiler.identifierNotEnd)})
		push_token("word", name)
	}

	function handle_string(openingChar) {
		let escaped = false
		function loop() {
			let past = ""
			while (true) {
				const char = next_char()
				// if the character does not exist end right now
				if (!char) {
					back_char()
					return past
				}
				if (char == "\\") {
					escaped = true
				} else {
					if (!escaped && char == openingChar) {
						back_char()
						return past
					}
					escaped = false
					past += char
				}
			}
		}
		push_token("string", loop())
		// eat the "
		context.i++
		context.column++
	}

	function handle_number() {
		back_char()
		push_token("number", Number(read_while((char) => {return char.match(/[0-9\.]/)})))
	}

	function handle_punctuation() {
		back_char()
		const char = next_char()
		push_token("punctuation", char)
	}

	function handle_comment() {
		read_while((char) => {return char != "\n"})
	}

	function handle_multiline_comment() {
		read_while((char) => {
			return !(char == "*" && Modlite_compiler.string[context.i] == "/")
		})
		// eat the "*" and the "/"
		next_char()
		next_char()
	}

	function handle_operator() {
		back_char()
		push_token("operator", next_char())
	}

	function err(msg) {
		Modlite_compiler.handle_error(msg, context.lineNumber)
		throw "[lexar error]";
	}

	return tokens
}

Modlite_compiler.parse = (context, tokens, inExpression) => {
	context.level++
	let exit = false
	let build = []
	while (context.i < tokens.length && !exit) {
		const token = next_token()
		handle_token(token)
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

	function handle_token(token) {

		if (inExpression) {
			// if (context.i >= tokens.length)
			if (!tokens[context.i] || (token.type != "operator" && tokens[context.i].type != "operator")) {
				exit = true
			}
		}

		if (token.type == "word") {
			handle_word(token)
		}

		else if (token.type == "string") {
			handle_string(token)
		}

		else if (token.type == "number") {
			handle_number(token)
		}

		else if (token.type == "operator") {
			handle_operator(token)
		}

		else if (token.type == "punctuation") {
			handle_punctuation(token)
		}
	}

	function handle_word(token) {
		// if it is true or false make a bool
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
		} else if (token.value == "function") {
			parse_function(token)
		} else if (token.value == "var") {
			parse_var()
		// } else if (token.value == "return") {
		// 	parse_return()
		} else {
			push_to_build({
				type: "var",
				value: token.value,
			})
		}
	}

	function handle_string(token) {
		push_to_build({
			type: "string",
			value: token.value,
		})
	}

	function handle_number(token) {
		push_to_build({
			type: "number",
			value: token.value,
		})
	}

	function handle_operator(token) {
		const prior = build.pop()

		if (prior == undefined) err(token.value + " without left side")

		if (token.value == "+" || token.value == "-" || token.value == "*" || token.value == "/") {
			if (prior.type != "number") err(token.value + " left side is not number")

			push_to_build({
				type: "operation",
				value: token.value,
				left: prior,
				right: Modlite_compiler.parse(context, tokens, true)[0],
			})
		} else if (token.value == "=") {
			// if (build[build.length-1] && build[build.length-1].type == "var" && build[build.length-1].value == "var") {
			// 	build.pop()
			// 	push_to_build({
			// 		type: "definition",
			// 		left: prior,
			// 		right: Modlite_compiler.parse(context, tokens, true)[0],
			// 	})
			// } else {
				
			// }
			push_to_build({
				type: "assignment",
				left: prior,
				right: Modlite_compiler.parse(context, tokens, true)[0],
			})
		}
	}

	function handle_punctuation(token) {
		if (token.value == "(") {
			
			push_to_build({
				type: "call",
				name: build.pop().value,
				value: Modlite_compiler.parse(context, tokens, false),
			})
		} else if (token.value == ")") {
			exit = true
			return
		} else if (token.value == "{") {
			err("unexpected {")
		} else if (token.value == "}") {
			exit = true
			return
		} else if (token.value == ".") {
			push_to_build({
				type: "method",
				value: next_token().value,
			})
		} else if (token.value == "!") {
			push_to_build({
				type: "assert",
				value: next_token().value,
			})
		}
	}

	function parse_function(token) {

		const name = next_token()

		let args = []

		// eat the "("
		next_token()
		// read until the ")"
		const argument_tokens = read_until((token) => {
			return token.type == "punctuation" && token.value == ")"
		})

		for (let index = 0; index < argument_tokens.length; index++) {
			const argument_token = argument_tokens[index];
			if (argument_token.type == "punctuation" && argument_token.value == ":") {
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
			name: name.value,
			args: args,
			return: Return.value,
			value: statement,
			lineNumber: token.lineNumber,
		})
	}

	function parse_var() {
		const name = next_token()

		const type = next_token()

		push_to_build({
			type: "definition",
			name: name.value,
			variableType: type.value,
		})
	}

	function parse_return() {
		push_to_build({
			type: "return",
			value: next_token(),
		})
	}

	function err(msg) {
		Modlite_compiler.handle_error(msg, tokens[context.i-1].lineNumber, context.level)
		throw "[parser error]";
	}

	context.level--
	return build
}

Modlite_compiler.generateBinary = (build_in, humanReadable) => {
	let binary = ["abcd"]
	// list of function calls
	let callLocations = {}
	// list of functions
	let functions = {}
	let checkSim = {
		level: -1,
		map: [[]],
		variables: [{}],
		lineNumber: 0,
	}

	// get the names of all the functions
	for (let index = 0; index < build_in.length; index++) {
		const thing = build_in[index];
		if (thing.lineNumber) checkSim.lineNumber = thing.lineNumber

		if (thing.type != "function") err("not a function at top level")

		if (callLocations[thing.name]) err(`function ${thing.name} already exists`)
		
		callLocations[thing.name] = []
		functions[thing.name] = {}
	}

	getBinary(build_in, false)

	// make sure the main function exists
	if (functions.main == undefined) {
		// Modlite_compiler.handle_error always expects a line number
		checkSim.lineNumber = 1
		err("no main function")
	}

	if (humanReadable) {
		binary[0] = "jump_to_main"
		binary = binary.join("\n")
	} else {
		// replace the "abcd" with a jump to the main function
		binary[0] = Modlite_compiler.binaryCodes.push + getCharacter(String(functions.main.location)) + Modlite_compiler.binaryCodes.break + Modlite_compiler.binaryCodes.jump
		binary = binary.join("")
	}

	for (const key in callLocations) {
		for (let index = 0; index < callLocations[key].length; index++) {
			const charPosition = callLocations[key][index];
			
			let temp = binary.split("")
			temp[charPosition] = getCharacter(String(functions[key].location))
			binary = temp.join("")
		}
	}

	return binary

	function getBinary(build, expectValues) {
		if (!expectValues) {
			checkSim.level++
			if (!checkSim.variables[checkSim.level]) checkSim.variables[checkSim.level] = {}
		}

		//
		// pre loop
		//

		for (let index = 0; index < build.length; index++) {
			const thing = build[index];
			if (thing.lineNumber) checkSim.lineNumber = thing.lineNumber

			if (thing.type == "function") {
				if (checkSim.level != 0) err("functions can only be defined at top level")
				functions[thing.name].args = thing.args
				functions[thing.name].return = thing.return
			} else if (thing.type == "definition") {
				checkSim.variables[checkSim.level][thing.name] = {
					type: thing.variableType,
					index: Object.keys(checkSim.variables[checkSim.level]).length+1,
				}
				if (Object.keys(checkSim.variables[checkSim.level]).length > 0) {
					if (humanReadable) {
						pushToBinary("addRegisters: " + Object.keys(checkSim.variables[checkSim.level]).length)
					} else {
						pushToBinary(Modlite_compiler.binaryCodes.addRegisters + Object.keys(checkSim.variables[checkSim.level]).length + Modlite_compiler.binaryCodes.break)
					}
				}
			}
		}

		//
		// main loop
		//

		for (let index = 0; index < build.length; index++) {
			const thing = build[index];
			if (thing.lineNumber) checkSim.lineNumber = thing.lineNumber

			if (thing.type == "function") {
				functions[thing.name].location = binary.join("").length

				if (humanReadable) {
					pushToBinary(thing.name + ":")
					getBinary(thing.value, false)
					if (functions[thing.name].args.length > 0) pushToBinary("pop: " + functions[thing.name].args.length)
					pushToBinary("jump")
				}
				else {
					getBinary(thing.value, false)
					if (functions[thing.name].args.length > 0) pushToBinary(Modlite_compiler.binaryCodes.pop + functions[thing.name].args.length + Modlite_compiler.binaryCodes.break)
					pushToBinary(Modlite_compiler.binaryCodes.jump)
				}

			} else if (thing.type == "string" || thing.type == "number") {
				if (!expectValues) err(`unexpected ${thing.type}`)
				if (humanReadable)
				pushToBinary(`push ${thing.type}: ` + thing.value)
				else
				pushToBinary(Modlite_compiler.binaryCodes.push + thing.value + Modlite_compiler.binaryCodes.break)
			} else if (thing.type == "bool") {
				if (!expectValues) err(`unexpected ${thing.type}`)
				if (humanReadable)
				pushToBinary("push bool: " + thing.value)
				else
				pushToBinary(Modlite_compiler.binaryCodes.push + (thing.value == true ? "1" : "0") + Modlite_compiler.binaryCodes.break)
			} else if (thing.type == "var") {
				if (!expectValues) err(`unexpected ${thing.type}`)

				const variable = checkSim.variables[checkSim.level][thing.value]

				if (!variable) err("variable " + thing.value + " does not exist")

				if (humanReadable) {
					pushToBinary("get: r" + variable.index)
				}
				else {
					pushToBinary(Modlite_compiler.binaryCodes.get + variable.index + Modlite_compiler.binaryCodes.break)
				}
			} else if (thing.type == "assignment") {
				const variable = checkSim.variables[checkSim.level][thing.left.value]
				if (!variable) err(`variable ${thing.left.value} does not exist`)
				if (humanReadable) {
					pushToBinary("push: " + thing.right.value)
					pushToBinary("set: r" + variable.index)
				}
				else {
					pushToBinary(Modlite_compiler.binaryCodes.push + thing.right.value + Modlite_compiler.binaryCodes.break)
					pushToBinary(Modlite_compiler.binaryCodes.set + variable.index + Modlite_compiler.binaryCodes.break)
				}
			} else if (thing.type == "call") {
				if (callLocations[thing.name]) {
					if (functions[thing.name].args.length < thing.value.length) err("not enough arguments")
					if (functions[thing.name].args.length > thing.value.length) err("too many arguments")
					if (humanReadable) {
						pushToBinary("push location to return to")
						getBinary(thing.value, true)
						pushToBinary("push location to go to")
						pushToBinary("jump")
					}
					else {
						let stuff = Modlite_compiler.binaryCodes.push + "*" + Modlite_compiler.binaryCodes.break + Modlite_compiler.binaryCodes.jump

						// push location to return to is very finicky but (binary.join("").length + stuff.length + stuff.length + 3) seems to work
						// more experimentation is required for how to compile jumps
						pushToBinary(Modlite_compiler.binaryCodes.push + getCharacter(String(binary.join("").length + stuff.length + stuff.length + 3)) + Modlite_compiler.binaryCodes.break)
						getBinary(thing.value, true)
						callLocations[thing.name].push(binary.join("").length + 1)
						pushToBinary(stuff)
					}
				} else {
					if (humanReadable) {
						getBinary(thing.value, true)
						pushToBinary("push string: " + thing.name)
						pushToBinary("externalJump")
					}
					else {
						getBinary(thing.value, true)
						pushToBinary(Modlite_compiler.binaryCodes.push + thing.name + Modlite_compiler.binaryCodes.break + Modlite_compiler.binaryCodes.externalJump)
					}
				}
			}
		}

		if (!expectValues) {
			if (Object.keys(checkSim.variables[checkSim.level]).length > 0) {
				if (humanReadable) {
					pushToBinary("removeRegisters: " + Object.keys(checkSim.variables[checkSim.level]).length)
				} else {
					pushToBinary(Modlite_compiler.binaryCodes.removeRegisters + Object.keys(checkSim.variables[checkSim.level]).length + Modlite_compiler.binaryCodes.break)
				}
			}

			delete checkSim.variables[checkSim.level]
			checkSim.level--
		}
	}

	function getCharacter(string) {
		return string.split(' ').map(char => String.fromCharCode(parseInt(char, 10))).join('');
	}

	function pushToBinary(string) {
		binary.push(string)
	}

	function err(msg) {
		Modlite_compiler.handle_error(msg, checkSim.lineNumber, checkSim.level)
		throw "[check error]";
	}
	
	// return binary.map(char => Modlite_compiler.binaryCodes(char)).join('');
}

Modlite_compiler.handle_error = (error, lineNumber, level) => {
    const lines = Modlite_compiler.string.split("\n")
    let msg = `${error} at line ${lineNumber}\n`

    if (lines[lineNumber-4] != undefined) msg += getLineNumber(lineNumber-3) + " | "       + removeSpacesOrTabsAtStart(lines[lineNumber-4]) + "\n"
    if (lines[lineNumber-3] != undefined) msg += getLineNumber(lineNumber-2) + " | "       + removeSpacesOrTabsAtStart(lines[lineNumber-3]) + "\n"
    if (lines[lineNumber-2] != undefined) msg += getLineNumber(lineNumber-1) + " | "       + removeSpacesOrTabsAtStart(lines[lineNumber-2]) + "\n"
    if (lines[lineNumber-1] != undefined) msg += getLineNumber(lineNumber  ) + " | =->   " + removeSpacesOrTabsAtStart(lines[lineNumber-1]) + "\n"
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
            if (!foundChar && (string[i] == " " || string[i] == "   ")) continue
             
            newString += string[i]
            foundChar = true
        }
        return newString
    }
}

function parseCode(string) {
	let parse
	if (Modlite_compiler.devlog) console.time("parse Modlite")
	try {
		parse = Modlite_compiler.parse({ lineNumber: 1, level: -1, i: 0 }, Modlite_compiler.lex(string), false)
	} catch(err) {
		if (err != "[lexar error]" && err != "[parser error]") console.error(err)
		if (Modlite_compiler.devlog) console.timeEnd("parse Modlite")
		return
	}
	if (Modlite_compiler.devlog) console.timeEnd("parse Modlite")
	return parse
}

function compileCode(string, humanReadable) {
	let binary
	if (Modlite_compiler.devlog) console.time("compile Modlite")
	try {
		binary = Modlite_compiler.generateBinary(Modlite_compiler.parse({ lineNumber: 1, level: -1, i: 0 }, Modlite_compiler.lex(string), false), humanReadable)
	} catch(err) {
		if (err != "[lexar error]" && err != "[parser error]" && err != "[check error]") console.error(err)
		if (Modlite_compiler.devlog) console.timeEnd("compile Modlite")
		return
	}
	if (Modlite_compiler.devlog) console.timeEnd("compile Modlite")
	return binary
}