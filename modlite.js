// Modlite Rewrite 12

/* 
	A work in progress programming language.
	Currently compiles to a custom operation code and can run in JavaScript.
*/

// Modlite building environment
const Modlite_compiler = {
	version: "12.0",
	string: "",
	devlog: true,
	debug: false,

	exposedVars: {},

	modules: {},

	// stuff for the lexar
	openString: /[\"\'\`]/,
	identifierStart: /[a-zA-Z\_]/,
	identifierNotEnd: /[a-zA-Z0-9\_]/,

	punctuation: /[\(\)\{\}\.\!\:]/,

	operator: /[\+\-\*\/\=]/,
	
	binaryCodes: {
		push: "a",
		pop: "b",
		addRegisters: "c",
		set: "e",
		get: "f",
		jump: "g",
		conditionalJump: "h",
		externalJump: "i",
		return: "j",
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
		// } else if (token.value == "var") {
		// 	parse_var()
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
		if (prior == undefined) err(token.value + " without left side")

		if (token.value == "+" || token.value == "-" || token.value == "*" || token.value == "/") {
			const prior = build[build.length-1]
			if (prior.type != "number") err(token.value + " left side is not number")

			push_to_build({
				type: "operation",
				value: token.value,
				left: build.pop(),
				right: Modlite_compiler.parse(context, tokens, true)[0],
			})
		} else if (token.value == "=") {
			// push_to_build({
			// 	type: "assignment",
			// 	left: get_token(-2),
			// 	right: next_token(),
			// })
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

		// eat the "{"
		next_token()

		const statement = Modlite_compiler.parse(context, tokens, false)

		push_to_build({
			type: "function",
			name: name.value,
			args: args,
			value: statement,
			lineNumber: token.lineNumber,
		})
	}

	// function parse_var() {
	// 	const left = next_token()

	// 	// eat the "="
	// 	const equals = next_token()
	// 	if (equals.type != "operator" || equals.value != "=") err("parse_var not an equals")
		
	// 	const right = next_token()

	// 	push_to_build({
	// 		type: "definition",
	// 		name: left.value,
	// 		value: right,
	// 	})
	// }

	// function parse_return() {
	// 	push_to_build({
	// 		type: "return",
	// 		value: next_token(),
	// 	})
	// }

	function err(msg) {
		Modlite_compiler.handle_error(msg, tokens[context.i-1].lineNumber, context.level)
		throw "[parser error]";
	}

	context.level--
	return build
}

Modlite_compiler.generateBinary = (build_in, humanReadable) => {
	let binary = ["abc"]
	let functionlocations = {}
	let checkSim = {
		level: -1,
		map: [[]],
		variables: [{}],
		globals: {},
		// just leave it as Infinity until it gets set to a lineNumber
		lineNumber: Infinity,
	}

	getBinary(build_in)

	if (functionlocations.main == undefined) {
		// Modlite_compiler.handle_error always expects a line number
		checkSim.lineNumber = 1
		err("no main function")
	}

	binary[0] = Modlite_compiler.binaryCodes.push + getCharacter(String(functionlocations.main)) + Modlite_compiler.binaryCodes.break + Modlite_compiler.binaryCodes.externalJump

	if (humanReadable) {
		binary[0] = ""
		return binary.join("\n")
	} else {
		return binary.join("")
	}

	function getBinary(build) {
		checkSim.level++
		for (let index = 0; index < build.length; index++) {
			const thing = build[index];
			if (thing.lineNumber) checkSim.lineNumber = thing.lineNumber

			if (checkSim.level == 0 && thing.type != "function") {
				err("not a function at top level")
			}

			if (thing.type == "function") {
				if (checkSim.level != 0) err("functions can only be defined at top level")
				functionlocations[thing.name] = binary.join("").length
				if (humanReadable) {
					pushToBinary(thing.name + ":")
					getBinary(thing.value)
					pushToBinary("return")
				}
				else {
					getBinary(thing.value)
					getBinary(Modlite_compiler.binaryCodes.jump)
				}
			} else if (thing.type == "string") {
				if (humanReadable)
				pushToBinary("push string: " + thing.value)
				else
				pushToBinary(Modlite_compiler.binaryCodes.push + thing.value + Modlite_compiler.binaryCodes.break)
			} else if (thing.type == "number") {
				if (humanReadable)
				pushToBinary("push number: " + thing.value)
				else
				pushToBinary(Modlite_compiler.binaryCodes.push + thing.value + Modlite_compiler.binaryCodes.break)
			} else if (thing.type == "bool") {
				if (humanReadable)
				pushToBinary("push bool: " + thing.value)
				else
				pushToBinary(Modlite_compiler.binaryCodes.push + (thing.value == true ? "1" : "0") + Modlite_compiler.binaryCodes.break)
			} else if (thing.type == "var") {
				console.log("var")
				// if (humanReadable)
				// pushToBinary("retrive var: " + thing.value)
				// else
				// pushToBinary(Modlite_compiler.binaryCodes.retrive + thing.value + Modlite_compiler.binaryCodes.break)
			} else if (thing.type == "call") {
				if (humanReadable) {
					pushToBinary("push location to return to")
					getBinary(thing.value)
					pushToBinary("push string: " + thing.name)
					pushToBinary("externalJump")
				}
				else {
					getBinary(thing.value)
					let stuff = Modlite_compiler.binaryCodes.push + thing.name + Modlite_compiler.binaryCodes.break + Modlite_compiler.binaryCodes.externalJump
					pushToBinary(Modlite_compiler.binaryCodes.push + getCharacter(String(binary.join("").length + stuff.length + 2 + 1)) + Modlite_compiler.binaryCodes.break)
					pushToBinary(stuff)
				}
			}
		}
		checkSim.level--
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
        if (lineNumber+3 > 10 && lineNumberStr.length < 2) {
            lineNumberStr = "0" + lineNumberStr
        }
        if (lineNumber+3 > 100 && lineNumberStr.length < 3) {
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