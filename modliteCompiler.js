// Modlite Compiler Rewrite 13

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
		"function",
		"return",
		"macro",
		"import",
		"from",
		
		"if",
		"else",
		"switch",
		"while",
		"as",
		"class",
		"var",

		"true",
		"false",
	],
	
	binaryCodes: [
		"jump",
		"conditionalJump",
		"notConditionalJump",
		"externalJump",
	
		"load",
		"staticTransfer",
		"dynamicTransfer",

		// "push",
		// "pop",
	
		"add",
		"subtract",
		"multiply",
		"divide",
	
		"equivalent",
		"greaterThan",
	]
}

function toHex(number, length) {
	let hex

	hex = Math.abs(number).toString(16)

	while (hex.length < length) {
		hex = "0" + hex
	}

	return "0x" + hex
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
				} else if (token.value == "macro") {
					parse_macro(token, true)
				} else if (next.value == "var") {
					parse_definition(next, true)
				} else if (next.value == "class") {
					parse_class(next, true)
				} else {
					err("unexpected 'public' keyword")
				}
			} else if (token.value == "function") {
				parse_function(token, false)
			} else if (token.value == "macro") {
				parse_macro(token, false)
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
			let parse

			if (token.value[0] == "end") {
				if (end != "@end") err("expected " + end)
				return build
			}

			parse = Modlite_compiler.parse(context, tokens, false, "@end")

			// if (token.value[1].length == 0) {
			// 	parse = Modlite_compiler.parse(context, tokens, false, "any")	
			// } else {
			// 	parse = Modlite_compiler.parse(context, tokens, false, "@end")
			// }

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
				if (prior.type != "word") err("memberAccess expected word before `.`")

				const next = next_token()

				if (next.type != "word") err("memberAccess expected word after `.`")

				push_to_build({
					type: "memberAccess",
					left: [prior],
					right: [{
						type: "string",
						value: next.value,
					}],
				})
			} else if (token.value == "!") {
				if (prior.type != "word") err("typeCast expected word before `!`")

				const next = next_token()

				if (next.type != "word") err("typeCast expected type name after `!`")

				push_to_build({
					type: "typeCast",
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
		if (end == "any") {
			return build
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

		// eat the ":"
		const colon = next_token()

		if (colon.value != ":") err("function expected colon and then return type")

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

	function parse_macro(token, isPublic) {
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

		// eat the ":"
		const colon = next_token()

		if (colon.value != ":") err("macro expected colon and then return type")

		const Return = next_token()
		if (Return.type != "word") err("macros must have a specified return type (if your macro does not return anything specify `Void`)")

		// eat the "{"
		next_token()

		const codeBlock = Modlite_compiler.parse(context, tokens, false, "}")

		push_to_build({
			type: "macro",
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

	let dataLength = 0
	let buffer = new ArrayBuffer(2048)
	let data = new DataView(buffer);

	let locations = {}
	
	while (index < assembly.length) {
		const thing = assembly[index];
		
		if (thing.startsWith("@")) {
			if (locations[thing.slice(1, thing.length)]) {
				if (locations[thing.slice(1, thing.length)].position) {
					throw `location ${thing.slice(1, thing.length)} already exists`
				}
			} else {
				locations[thing.slice(1, thing.length)] = {
					position: 0,
					references: []
				}
			}

			locations[thing.slice(1, thing.length)].position = dataLength
		}
		
		else if (thing.startsWith("!")) {
			const instruction = thing.slice(1, thing.length).split("|")
			const instructionName = instruction[0]
			const flag1Set = instruction[1] && instruction[1][0] == "1"
			const flag2Set = instruction[1] && instruction[1][1] == "1"
			
			if (Modlite_compiler.binaryCodes.includes(instructionName)) {
				const byte = (Modlite_compiler.binaryCodes.indexOf(instructionName) << 2) + (flag1Set ? 0b10 : 0) + (flag2Set ? 0b01 : 0)

				data.setUint8(dataLength++, byte)
			} else {
				throw "unknown assembly instruction " + instructionName
			}

		}

		else if (thing.startsWith("&")) {
			if (!locations[thing.slice(1, thing.length)]) locations[thing.slice(1, thing.length)] = {
				position: undefined,
				references: []
			}

			locations[thing.slice(1, thing.length)].references.push(dataLength)
			dataLength += 4
		}

		else if (thing.startsWith("$")) {
			const value = thing.slice(1, thing.length)

			for (let i = 0; i < value.length; i++) {
				data.setUint8(dataLength++, value.charCodeAt(i))
			}
		}
		
		else if (thing.startsWith("0x")) {
			const string = thing.slice(2, thing.length)

			if (string.length <= 2) {
				data.setUint8(dataLength++, parseInt(string, 16))
			}
			else if (string.length <= 4) {
				data.setUint16(dataLength, parseInt(string, 16))
				dataLength += 2
			}
			else if (string.length <= 8) {
				data.setUint32(dataLength, parseInt(string, 16))
				dataLength += 4
			}
			else {
				throw `Hex value too large: ${thing}`
			}
		}
		
		else if (thing == "\n" || thing == "") {}
		
		else {
			throw `unknown assembly type \`${thing}\``
		}

		index++
	}

	if (logEverything) console.log("locations", JSON.stringify(locations, null, 2), "\n")

	for (const key in locations) {
		const location = locations[key]

		for (let i = 0; i < location.references.length; i++) {
			const reference = location.references[i]
			
			data.setUint32(reference, location.position)
		}
	}

	let newBuffer = new ArrayBuffer(dataLength)
	let newData = new DataView(newBuffer);

	for (let i = 0; i < dataLength; i++) {
		newData.setUint8(i, data.getUint8(i))
	}

	return newData
}

// --------

import fs from "fs"
import { join, dirname } from "path"

const rootPath = process.argv[2]

if (!rootPath) throw "no path specified"

const logEverything = process.argv.includes("--log")

const testBuild = process.argv.includes("--test")

// const asAssembly = process.argv.includes("--asAssembly")

if (logEverything) console.log("process.argv", process.argv)

Modlite_compiler.compileCode = (rootPath) => {
	const jsonString = fs.readFileSync(join(rootPath, "conf.json"), "utf8")

	const conf = JSON.parse(jsonString)

	if (logEverything) console.log(`conf: ${JSON.stringify(conf, null, 2)}\n`)

	if (!conf.entry) throw "no entry in conf"
	if (!conf.entry.endsWith(".modlite")) throw "entry must end with .modlite"

	if (!conf.saveTo) throw "no saveTo in conf"

	if (!conf.flags) throw "no flags in conf"

	try {
		let assembly = []

		if (conf.asAssembly) {
			if (logEverything) console.time("read assembly")

			const text = fs.readFileSync(join(rootPath, conf.entry), "ascii")
			assembly = text.split(/[\n\t" "]+/g)

			if (logEverything) {
				console.timeEnd("read assembly")
				console.log("")
			}
		} else {

			let context = {
				globalFlags: conf.flags,

				rootPath: rootPath,
				globalCount: 1,
				uniqueIdentifierCounter: 0,

				types: [],
				recursionHistory: [],

				startAssembly: [],
				mainAssembly: [],
				constants: {},

				error: false,
			}

			let files = {}

			Modlite_compiler.getAssembly(conf.entry, context, files, true)
			if (logEverything) console.log("files:\n", JSON.stringify(files) + "\n")

			assembly.push(...context.startAssembly)
			assembly.push(
				"!load", "0xFFFFFFFF", "0x00", "\n",
				"!jump", "\n",
			)
			assembly.push(...context.mainAssembly)

			for (const key in context.constants) {
				assembly.push("@"+key, "\n", "$"+context.constants[key], "0x00", "\n")
			}

		}

		if (logEverything) {
			console.log("assembly:\n " + assembly.join(" ") + "\n")
			console.time("compile")
		}

		const opCode = Modlite_compiler.assemblyToOperationCode(assembly)
		if (logEverything) {
			console.timeEnd("compile")
			console.log("\nopCode:")
			console.log(opCode)
			console.log("")

			console.time("save to file")
		}

		// save the opCode to a file in the rootPath
		fs.writeFile(join(rootPath, conf.saveTo), opCode, function (err) {
			if (err) throw err
			if (testBuild) {
				console.log("test build saved to " + join(rootPath, conf.saveTo))
			} else {
				console.log("saved to " + join(rootPath, conf.saveTo))
			}

			if (logEverything) {
				console.log("")
				console.timeEnd("save to file")
			}
		});
	} catch (error) {
		if (error != "[lexar error]" && error != "[parser error]" && error != "[getAssembly error]") throw error
		return
	}
}

Modlite_compiler.getAssembly = (path, context, files, main) => {
	if (logEverything) console.time("read file")
	const text = fs.readFileSync(join(context.rootPath, path), "utf8")
	if (logEverything) {
		console.timeEnd("read file")
		console.log(`\n------- ${join(context.rootPath, path)} -------\n${text}\n`)
	}

	const tokens = Modlite_compiler.lex(text)
	if (logEverything) console.log("tokens:\n" + JSON.stringify(tokens, null) + "\n")

	const build_in = Modlite_compiler.parse({ lineNumber: 1, level: -1, i: 0 }, tokens, false, undefined)
	if (logEverything) console.log("build:\n" + JSON.stringify(build_in, null) + "\n")

	let lineNumber = 0

	let level = -1
	let levelInformation = [{type: "top"}]
	let variables = [{
		Uint8: {
			type: "type",
			biteSize: 1,
		}
	}]

	let recursionHistory = []

	let outputRegister = "0x00"

	files[path] = {}

	for (let index = 0; index < build_in.length; index++) {
		const thing = build_in[index];
		if (thing.lineNumber) lineNumber = thing.lineNumber

		if (thing.type != "function" && thing.type != "macro" && thing.type != "import" && thing.type != "definition" && thing.type != "compilerSetting" && thing.type != "class") err("not a function, macro, import, definition, compilerSetting or class at top level")
	}

	assemblyLoop(context.mainAssembly, build_in, "top", "normal", ["newScope"])

	if (context.error) {
		throw "[getAssembly error]";
	}

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

				console.log("thing.args", thing.args)

				let allocatedBiteSize = 0

				for (let i = 0; i < thing.args.length; i++) {
					const arg = thing.args[i];
					
					const typeVar = getVariable(arg.type)

					if (!typeVar) err(`no type named ${arg.type}`)

					if (typeVar.type != "type") err(`${arg.type} is not a type`)

					allocatedBiteSize += typeVar.biteSize
				}

				variables[0][thing.name] = {
					type: "Function",
					public: thing.public,
					ID: path + "_" + thing.name,
					args: thing.args,
					return: thing.return,
					allocatedBiteSize: allocatedBiteSize,
				}

				files[path][thing.name] = variables[0][thing.name]
			}

			else if (thing.type == "macro") {
				if (level != 0) err("macros can only be defined at top level")
				if (variables[0][thing.name]) err(`variable ${thing.name} already exists`)

				if (thing.name == "main") err("a macro cannot be named 'main' (choose a different name for your macro or make it a function)")

				variables[0][thing.name] = {
					type: "Macro",
					codeBlock: thing.codeBlock,
					public: thing.public,
					ID: path + "_" + thing.name,
					args: thing.args,
					return: thing.return,
				}
			}
			
			else if (thing.type == "class") {
				// let data = {}
				// let definitionCount = 0
				// for (let i = 0; i < thing.value.length; i++) {
				// 	const inClass = thing.value[i];
				// 	if (inClass.type == "definition") {
				// 		data[inClass.name] = {
				// 			type: inClass.variableType,
				// 			index: definitionCount++,
				// 			initialized: false,
				// 		}
				// 	} else if (inClass.type == "function") {
				// 		data[inClass.name] = {
				// 			type: "function",
				// 			ID: path + " class " + thing.name + " " + inClass.name,
				// 			args: inClass.args,
				// 			return: inClass.return,
				// 		}
				// 	} else {
				// 		err(`unexpected ${inClass.type} in class, expected definition or function`)
				// 	}
				// }
				// variables[0][thing.name] = {
				// 	type: "class",
				// 	public: thing.public,
				// 	data: data,
				// }
				// files[path][thing.name] = variables[0][thing.name]
			}
			
			else if (thing.type == "definition") {
				// if (Modlite_compiler.reservedWords.includes(thing.name)) err(`${thing.name} is a reserved word`)
				// if (level == 0) {
				// 	variables[level][thing.name] = {
				// 		type: thing.variableType,
				// 		index: context.globalCount++,
				// 		global: true,
				// 		public: thing.public,
				// 		initialized: false,
				// 	}
				// 	files[path][thing.name] = variables[level][thing.name]
				// } else {
				// 	variables[level][thing.name] = {
				// 		type: thing.variableType,
				// 		index: getRegisterRequirement(),
				// 		global: false,
				// 		initialized: false,
				// 	}
				// }
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
					// if (thing.path == "StandardLibrary") {
					// 	let jsonString = fs.readFileSync(join(dirname(process.argv[1]), thing.path+".json"), "utf8")
		
					// 	const json = JSON.parse(jsonString)
		
					// 	for (let i = 0; i < thing.imports.length; i++) {
					// 		const importName = thing.imports[i][0];
					// 		const newName = thing.imports[i][1];
							
					// 		if (!json[importName]) err(`import ${importName} from json file ${thing.path} not found`)
		
					// 		if (variables[0][newName]) err(`Import with name ${newName} failed. Because a variable named ${newName} already exists.`)
		
					// 		variables[0][newName] = json[importName]
					// 	}
					// } else {
					// 	err(`'${thing.path}' does not have a valid file extension`)
					// }

					err(`'${thing.path}' does not have a valid file extension`)

				}
			}
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
						index: (-1-i)*4,
						global: false,
						initialized: true,
					}
				}

				levelInformation[level] = {
					type: "function",
					name: thing.name,
					returned: false,
					expectedReturnType: thing.return,
				}

				if (thing.name == "main") {
					// if name == "main" use "context.startAssembly" instead of "assembly"
					context.startAssembly.push(`@${variable.ID}`, "\n")

					assemblyLoop(context.startAssembly, thing.codeBlock, "function", buildType, ["newScope"])

					// context.startAssembly.push(`@end ${variable.ID}`, "\n")
				} else {
					pushToAssembly([`@${variable.ID}`])

					assemblyLoop(assembly, thing.codeBlock, "function", buildType, ["newScope"])

					// pushToAssembly([`@end ${variable.ID}`])

					if (levelInformation[level].returned == false) {
						// pop all arguments and the return address off the stack
						pushToAssembly(["!load", toHex(variables[0][thing.name].allocatedBiteSize+4, 8), "0x01"])
						pushToAssembly(["!add", "0x09", "0x01"])
						pushToAssembly(["!dynamicTransfer|10", "0x09", "0x00"])
						pushToAssembly(["!jump"])
					}
				}

				types.push(undefined)
			}

			else if (thing.type == "table") {
				err("tables are not available right now")

				types.push({type: "Table"})
			}

			else if (thing.type == "class") {
				err("classes are not available right now")

				for (let i = 0; i < thing.value.length; i++) {
					const inClass = thing.value[i];
					if (inClass.type == "function") {
						const method = variables[0][thing.name].data[inClass.name]

						// context.expectedReturnType = method.return

						assemblyLoop(assembly, inClass.codeBlock, "class", buildType, [])
						if (method.args.length > 0) {

						}
					}
				}

				types.push({type: thing.name})
			}

			else if (thing.type == "memberAccess") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				err("memberAccess is not available right now")

				const typelist = assemblyLoop(assembly, thing.left, "memberAccess", buildType, ["expectValues"])

				if (thing.left[0].type == "memberAccess") {
					assemblyLoop(assembly, thing.right, "memberAccess", buildType, ["expectValues"])
				} else {
					const variable = getVariable(typelist[0].type)

					if (variable && variable.type == "class") {
						if (!variable.data[thing.right[0]]) err(`class ${typelist[0].type} does not have a member named ${thing.right}`)

					} else {
						assemblyLoop(assembly, thing.right, "memberAccess", buildType, ["expectValues"])
					}
				}

				if (recursionHistory[recursionHistory.length-1] != "assignment_left") {

				}

				types.push(typelist[0])
			}

			else if (thing.type == "typeCast") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				const type = assemblyLoop(assembly, thing.left, "typeCast", buildType, flags)[0]

				types.push({type: thing.right[0].value})
			}
			
			else if (thing.type == "string") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				let constantID

				if (context.globalFlags.includes("simplifyConstants")) {
					for (const key in context.constants) {
						if (context.constants[key] == thing.value) {
							constantID = key
						}
					}
					if (!constantID) {
						constantID = "string"+Object.keys(context.constants).length

						context.constants[constantID] = thing.value
					}
				} else {
					constantID = "string"+Object.keys(context.constants).length

					context.constants[constantID] = thing.value
				}

				if (flags.includes("valueToRegister")) {
					pushToAssembly(["!load", "&"+constantID, outputRegister])
				} else {
					pushToAssembly_push("&"+constantID)
				}

				types.push({type: "String"})
			}

			else if (thing.type == "number") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				if (flags.includes("valueToRegister")) {
					pushToAssembly(["!load", toHex(thing.value, 8), outputRegister])
				} else {
					pushToAssembly_push(toHex(thing.value, 8))
				}

				types.push({type: "Number"})
			}
			
			else if (thing.type == "bool") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				if (flags.includes("valueToRegister")) {
					if (thing.value) {
						pushToAssembly(["!load", "0x00000001", outputRegister])
					} else {
						pushToAssembly(["!load", "0x00000000", outputRegister])
					}
				} else {
					if (thing.value) {
						pushToAssembly_push("0x00000001")
					} else {
						pushToAssembly_push("0x00000000")
					}
				}

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
					} else {
					}

					variable.initialized = true
				} else if (thing.left[0].type == "memberAccess") {
					checkType(memberAccessTypelist[0], typelist[0], thing.left)

				}

				types.push(undefined)
			}
			
			else if (thing.type == "word") {
				if (!flags.includes("expectValues")) err(`unexpected ${thing.type}`)

				const variable = getVariable(thing.value)
				if (!variable) err("variable " + thing.value + " does not exist")

				if (flags.includes("valueToRegister")) {
					if (variable.type == "Function") {

						pushToAssembly(["!load", "&"+variable.ID, outputRegister])

						types.push({type: variable.type})
					} else if (variable.type == "Macro") {
						assemblyLoop(assembly, variable.codeBlock, "macro", buildType, flags)

						types.push({type: variable.return})
					} else {
						if (variable.global) {
							err("no global")
						} else {
							if (!variable.initialized) err("variable " + thing.value + " is not initialized")

							pushToAssembly(["!load", toHex(variable.index, 8), "0x00"])

							pushToAssembly(["!add", "0x00", "0x09"])

							pushToAssembly(["!dynamicTransfer|10", "0x00", outputRegister])
						}
	
						types.push({type: variable.type})
					}
				} else {
					if (variable.type == "Function") {
						pushToAssembly_push("&"+variable.ID)

						types.push({type: variable.type})
					} else if (variable.type == "Macro") {
						assemblyLoop(assembly, variable.codeBlock, "macro", buildType, flags)

						types.push({type: variable.return})
					} else {
						if (variable.global) {
							err("no global")
						} else {
							if (!variable.initialized) err("variable " + thing.value + " is not initialized")

							// push a previous value on the stack onto the top of the stack
							pushToAssembly(["!load", toHex(variable.index, 8), "0x00"])
							pushToAssembly(["!add", "0x00", "0x09"])

							pushToAssembly(["!dynamicTransfer|11", "0x00", "0x09"])

							pushToAssembly(["!load", "0x00000004", "0x01"])
							pushToAssembly(["!subtract", "0x09", "0x01"])
						}
	
						types.push({type: variable.type})
					}
				}
			}
			
			else if (thing.type == "call") {
				let name = thing.name.value
				let variable = getVariable(name)

				if (Modlite_compiler.reservedWords.includes(name)) err(`${name} is a reserved word`)

				if (!variable) err(`(call) variable ${name} does not exist`)

				if (variable.type == "Function" || variable.type == "ExposedFunction" || variable.type == "Macro") {

					let typelist

					if (variable.type == "Function") {
						const return_location = "return_location" + context.uniqueIdentifierCounter++

						pushToAssembly_push("&"+return_location)
						typelist = assemblyLoop(assembly, thing.args, "call", buildType, ["expectValues"])
						
						outputRegister = "0x00"
						assemblyLoop(assembly, [thing.name], "call", buildType, ["expectValues", "valueToRegister"])
						pushToAssembly(["!jump"])
						pushToAssembly(["@" + return_location])

					} else if (variable.type == "ExposedFunction") {
						typelist = assemblyLoop(assembly, thing.args, "call", buildType, ["expectValues"])
						pushToAssembly(["!load", variable.ID, "0x00"])
						pushToAssembly(["!externalJump"])
					} else if (variable.type == "Macro") {
						if (!variable.args) err(`${name} is not a callable macro (remove the parentheses and use it like a variable)`)

						typelist = assemblyLoop([], thing.args, "call", buildType, ["expectValues"])

						variables[level+1] = {}

						for (let i = variable.args.length-1; i >= 0; i--) {
							const arg = variable.args[i];

							variables[level+1][arg.name] = {
								type: "Macro",
								codeBlock: [thing.args[i]],
								return: typelist[i].type,
							}
						}

						levelInformation[level] = {
							type: "macro",
							returned: false,
							expectedReturnType: variable.return,
						}

						assemblyLoop(assembly, variable.codeBlock, "macro", buildType, ["newScope"])
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
					}

					// if the exposedFunction returns something pop the return value off if it is not being used
					if (variable.type == "ExposedFunction" && variable.return != "Void" && !flags.includes("expectValues")) {
						pushToAssembly(["!load", "0x00000004", "0x01"])
						pushToAssembly(["!add", "0x09", "0x01"])
					}

					types.push({type: variable.return})
				} else if (variable.type == "class") {

					types.push({type: name})
				} else {
					err(`variable ${name} is not a Function or class`)
				}
			}

			else if (thing.type == "operation") {
				assemblyLoop(assembly, thing.left, "operation", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "operation", buildType, ["expectValues"])
				if (thing.value == "+") {
				} else if (thing.value == "-") {
				} else if (thing.value == "*") {
				} else if (thing.value == "/") {
				}

				types.push({type: "Number"})
			}


			else if (thing.type == "equivalent") {
				assemblyLoop(assembly, thing.left, "equivalent", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "equivalent", buildType, ["expectValues"])

				types.push({type: "Bool"})
			}

			else if (thing.type == "notEquivalent") {
				assemblyLoop(assembly, thing.left, "notEquivalent", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "notEquivalent", buildType, ["expectValues"])
				
				types.push({type: "Bool"})
			}

			else if (thing.type == "greaterThan") {
				assemblyLoop(assembly, thing.left, "greaterThan", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "greaterThan", buildType, ["expectValues"])

				types.push({type: "Bool"})
			}

			// lessThan is just greaterThan in reverse
			else if (thing.type == "lessThan") {
				assemblyLoop(assembly, thing.right, "lessThan", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.left, "lessThan", buildType, ["expectValues"])

				types.push({type: "Bool"})
			}

			else if (thing.type == "join") {
				assemblyLoop(assembly, thing.left, "join", buildType, ["expectValues"])
				assemblyLoop(assembly, thing.right, "join", buildType, ["expectValues"])

				types.push({type: "String"})
			}

			else if (thing.type == "if") {
				const if_true = "if_true" + context.uniqueIdentifierCounter++
				const if_end = "if_end" + context.uniqueIdentifierCounter++

				outputRegister = "0x01"
				const typelist = assemblyLoop(assembly, thing.condition, "if", buildType, ["expectValues", "valueToRegister"])

				if (typelist.length != 1) err("if statements require 1 Bool")
				if (typelist[0].type != "Bool") err(`if statement got type ${typelist[0].type} but expected type Bool`)

				if (thing.falseCodeBlock) {
					pushToAssembly(["!load", "&"+if_true, "0x00"])
					pushToAssembly(["!conditionalJump"])

					assemblyLoop(assembly, thing.falseCodeBlock, "if", buildType, [])

					pushToAssembly(["!load", "&"+if_end, "0x00"])
					pushToAssembly(["!jump"])

					pushToAssembly(["@" + if_true])

					assemblyLoop(assembly, thing.trueCodeBlock, "if", buildType, [])

					pushToAssembly(["@" + if_end])
				} else {
					pushToAssembly(["!load", "&"+if_end, "0x00"])
					pushToAssembly(["!notConditionalJump"])

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
					assemblyLoop(assembly, Case.codeBlock, "switch", buildType, [])
				}

				types.push(undefined)
			}

			else if (thing.type == "while") {
				const while_top = "while_top" + context.uniqueIdentifierCounter++
				const while_bottom = "while_bottom_id" + context.uniqueIdentifierCounter++
				assemblyLoop(assembly, thing.codeBlock, "while", buildType, [])

				assemblyLoop(assembly, thing.condition, "while", buildType, ["expectValues"])

				types.push(undefined)
			}

			else if (thing.type == "return") {
				const functionVariable = getVariable(getLevelInformationFunction().name)

				// pop all arguments and the return address off the stack
				pushToAssembly(["!load", toHex(functionVariable.allocatedBiteSize+4, 8), "0x01"])
				pushToAssembly(["!add", "0x09", "0x01"])
				pushToAssembly(["!dynamicTransfer|10", "0x09", "0x00"])

				// the return address is now in register zero

				let typelist
				if (thing.expression[0].type == "word" && thing.expression[0].value == "Void") {
					typelist = ["Void"]
				} else {
					typelist = assemblyLoop(assembly, thing.expression, "return", buildType, ["expectValues"])
				}

				if (typelist[0].type != levelInformation[level-1].expectedReturnType) err(`expected return type ${levelInformation[level-1].expectedReturnType} got ${typelist[0].type}`)

				// return
				pushToAssembly(["!jump"])

				levelInformation[level-1].returned = true

				types.push(undefined)
			}

			else if (thing.type == "case") {
				err("case not in switch statement")
			}

			else if (thing.type == "compilerSetting") {
				if (thing.name == "duplicate") {
					if (thing.args.length != 1) err("the duplicate compilerSetting expects one argument that tells the compiler how many times to duplicate the code block")
					for (let index = 0; index < thing.args[0]; index++) {
						assemblyLoop(assembly, thing.build, undefined, buildType, flags)
					}
				} else if (thing.name == "debug") {
					assemblyLoop(assembly, thing.build, undefined, "debug", [])
				} else if (thing.name == "optimize") {
					assemblyLoop(assembly, thing.build, undefined, "optimize", [])
				} else if (thing.name == "if_macro_type") {
					if (thing.args.length != 2) err("if_macro_type expects two arguments")
					const variable = getVariable(thing.args[0])

					if (!variable) err(`no macro named ${thing.args[0]}`)

					if (variable.type != "Macro") err(`${thing.args[0]} is not a macro`)

					if (variable.return == thing.args[1]) {
						assemblyLoop(assembly, thing.build, undefined, buildType, flags)
					}
				} else if (thing.name == "compiler_error") {
					err(thing.build[0].value)
				} else {
					err(`unknown compiler setting ${thing.name}`)
				}
			}
		}

		if (flags.includes("newScope")) {
			if (levelInformation[level]) levelInformation.pop()
			variables.pop()
			level--
		}

		if (recursionName) recursionHistory.pop()

		return types

		function pushToAssembly(data) {
			assembly.push(...data, "\n")
		}

		function pushToAssembly_push(data) {
			pushToAssembly(["!load", data, "0x01"])
			pushToAssembly(["!dynamicTransfer|01", "0x01", "0x09"])

			pushToAssembly(["!load", "0x00000004", "0x01"])
			pushToAssembly(["!subtract", "0x09", "0x01"])

		}	
	}

	function getLevelInformationFunction() {
		for (let i = levelInformation.length-1; i >= 0; i--) {
			if (levelInformation[i].type == "function") {
				return levelInformation[i]
			}
		}
	}

	function getVariable(name) {
		for (let i = variables.length-1; i >= 0; i--) {
			if (variables[i][name]) {
				return variables[i][name]
			}
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

			if (actual.type == "Number") {
				if (
					expected.type == "Uint8"
				) {
					return
				}
			}

			if (expected.type != actual.type) err(`expected type ${expected.type} but got type ${actual.type}`)
		}
	}

	function err(msg) {
		Modlite_compiler.handle_error(msg, lineNumber, level)
		context.error = true
	}
}

Modlite_compiler.compileCode(rootPath)