// Modlite Rewrite 13

/* 
	A work in progress programming language.
	Currently compiles to a custom operation code and can run in JavaScript.

	node modliteCompiler.js ./tests/return
	node modliteCompiler.js ./tests/return true
*/

// Modlite building environment
const Modlite_compiler = {
	version: "13.1.0",
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
		// jump but only if a condition is true
		conditionalJump: "h",
		// jump but only if a condition is false
		notConditionalJump: "i",
		// jumps to code in the host programming language
		externalJump: "j",
	
		//
		// math
		//
	
		add: "k",
		subtract: "l",
		multiply: "m",
		divide: "n",
		
		// check to see if two values are equivalent
		equivalent: "z",
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
					if (escaped == true) {
						past += char
						escaped = false
					} else {
						escaped = true
					}
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
		} else if (token.value == "public") {
			const next = next_token()
			if (next.type != "word" || next.value != "function") err("unexpected 'public' keyword")
			parse_function(next, true)
		} else if (token.value == "function") {
			parse_function(token, false)
		} else if (token.value == "var") {
			parse_var()
		} else if (token.value == "import") {
			parse_import()
		} else if (token.value == "if") {
			parse_if()
		} else if (token.value == "switch") {
			parse_switch()
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
				left: [prior],
				right: [Modlite_compiler.parse(context, tokens, true)[0]],
			})
		} else if (token.value == "=") {
			const next = next_token()
			if (next.type == "operator" && next.value == "=") {
				push_to_build({
					type: "equivalent",
					left: [prior],
					right: [Modlite_compiler.parse(context, tokens, true)[0]],
				})
			} else {
				// undo the next_token()
				back_token()
				push_to_build({
					type: "assignment",
					left: [prior],
					right: [Modlite_compiler.parse(context, tokens, true)[0]],
				})
			}
		}
	}

	function handle_punctuation(token) {
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
					value: Modlite_compiler.parse(context, tokens, false),
				})
			}
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
			const next = next_token()
			if (next.type == "punctuation" && next.value == "(") {
				push_to_build({
					type: "assert",
					value: next_token().value,
				})
			} else {
				push_to_build({
					type: "assert",
					value: next.value,
				})
			}
		}
	}

	function parse_function(token, isPublic) {

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
			public: isPublic,
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

	// function parse_return() {
	// 	push_to_build({
	// 		type: "return",
	// 		value: next_token(),
	// 	})
	// }

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
			imports.push(thing.value)
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
import { join } from "path"

const rootPath = process.argv[2]

if (!rootPath) throw "no path specified"

const logEverything = process.argv[3] == "true"

Modlite_compiler.compileCode = (rootPath) => {
	const jsonString = fs.readFileSync(join(rootPath, "conf.json"), "utf8")

	const conf = JSON.parse(jsonString)

	if (logEverything) console.log(`conf: ${JSON.stringify(conf, null, 2)}\n`)

	if (!conf.entry) throw "no entry in conf"
	if (!conf.entry.endsWith(".modlite")) throw "entry must end with .modlite"

	if (!conf.saveTo) throw "no saveTo in conf"

	try {
		let files = {}
		let assembly = [
			"push", "*" + conf.entry + " main", "\n",
			"jump", "\n"
		]
		Modlite_compiler.getAssembly(rootPath, conf.entry, files, assembly)
		if (logEverything) console.log("assembly:\n " + assembly.join(" ") + "\n")

		const opCode = Modlite_compiler.assemblyToOperationCode(assembly)
		if (logEverything) console.log("opCode:\n" + opCode + "\n")

		// save the opCode to a file in the rootPath
		fs.writeFile(join(rootPath, conf.saveTo), opCode, function (err) {
			if (err) throw err
			console.log("saved to " + join(rootPath, conf.saveTo))
		});
	} catch (error) {
		if (error != "[lexar error]" && error != "[parser error]" && error != "[getAssembly error]") throw error
		return
	}
}

Modlite_compiler.getAssembly = (rootPath, path, files, assembly) => {
	const text = fs.readFileSync(join(rootPath, path), "utf8")
	if (logEverything) console.log(`------- ${join(rootPath, path)} -------\n${text}\n`)

	const tokens = Modlite_compiler.lex(text)
	if (logEverything) console.log("tokens:\n" + JSON.stringify(tokens, null) + "\n")

	const build_in = Modlite_compiler.parse({ lineNumber: 1, level: -1, i: 0 }, tokens, false)
	if (logEverything) console.log("build:\n" + JSON.stringify(build_in, null) + "\n")

	let level = -1
	let lineNumber = 0
	let variables = [{}]

	files[path] = {}

	for (let index = 0; index < build_in.length; index++) {
		const thing = build_in[index];
		if (thing.lineNumber) lineNumber = thing.lineNumber

		if (thing.type != "function" && thing.type != "import") err("not a function or import at top level")
	}

	assemblyLoop(build_in, true, false)

	return assembly

	function assemblyLoop(build, newScope, expectValues) {
		if (newScope) {
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
				if (variables[0][thing.name]) err(`function ${thing.name} already exists`)
		
				variables[0][thing.name] = {
					type: "function",
					ID: path + " " + thing.name,
					args: thing.args,
					return: thing.return,
				}
				files[path][thing.name] = variables[0][thing.name]
			} else if (thing.type == "import") {
				if (thing.path.endsWith(".modlite")) {
					if (!files[thing.path]) {
						Modlite_compiler.getAssembly(rootPath, thing.path, files, assembly)
					}
					for (let i = 0; i < thing.imports.length; i++) {
						const importName = thing.imports[i];
	
						if (!files[thing.path][importName]) err(`import ${importName} from modlite file ${thing.path} not found`)

						if (variables[0][importName]) err(`Import with name ${importName} failed. Because a variable named ${importName} already exists.`)
	
						variables[0][importName] = files[thing.path][importName]
					}
					const text = fs.readFileSync(join(rootPath, thing.path), "utf8")
				} else if (thing.path.endsWith(".json")) {
					const jsonString = fs.readFileSync(join(rootPath, thing.path), "utf8")
	
					const json = JSON.parse(jsonString)
	
					for (let i = 0; i < thing.imports.length; i++) {
						const importName = thing.imports[i];
						
						if (!json[importName]) err(`import ${importName} from json file ${thing.path} not found`)
	
						if (variables[0][importName]) err(`Import with name ${importName} failed. Because a variable named ${importName} already exists.`)
	
						variables[0][importName] = json[importName]
					}
				} else {
					err(`${thing.path} is not a valid file extension`)
				}
			} else if (thing.type == "definition") {
				variables[level][thing.name] = {
					type: thing.variableType,
					index: Object.keys(variables[level]).length+1,
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

				pushToAssembly([`@${getVariable(thing.name).ID}`])
				assemblyLoop(thing.value, true, false)
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
				variables[level][thing.name] = {
					type: thing.variableType,
					index: getRegisterRequirement(),
				}
			}
			
			// get a variable `print(a)`
			//                       ^
			else if (thing.type == "var") {
				if (!expectValues) err(`unexpected ${thing.type}`)

				const variable = getVariable(thing.value)
				if (!variable) err("variable " + thing.value + " does not exist")

				if (variable.type == "function") {
					pushToAssembly(["push", "*" + variable.ID])
				} else {
					pushToAssembly(["get", String(variable.index)])
				}
			}
			
			else if (thing.type == "assignment") {
				const variable = getVariable(thing.left[0].value)
				if (!variable) err(`variable ${thing.left[0].value} does not exist`)

				assemblyLoop(thing.right, false, true)
				pushToAssembly(["set", String(variable.index)])
			}
			
			else if (thing.type == "call") {
				const variable = getVariable(thing.name)

				if (!variable) err(`variable ${thing.name} does not exist`)

				if (variable.type != "function" && variable.type != "exposedFunction") err(`variable ${thing.name} is not a function`)

				if (variable.args.length > thing.value.length) err(`not enough arguments for ${thing.name} requires ${variable.args.length}`)
				if (variable.args.length < thing.value.length) err(`too many arguments for ${thing.name} requires ${variable.args.length}`)

				if (variable.type == "exposedFunction") {
					assemblyLoop(thing.value, false, true)
					pushToAssembly(["push", thing.name])
					pushToAssembly(["externalJump"])
				} else {
					const jump_id = assembly.length
					pushToAssembly(["push", "*" + jump_id])
					assemblyLoop(thing.value, false, true)
					pushToAssembly(["push", "*" + variable.ID])
					pushToAssembly(["jump"])
					pushToAssembly(["@" + jump_id])
				}

				// if the function returns something pop the return value off because it is not being used
				if (variable.return != "void" && !expectValues) {
					pushToAssembly(["pop", "1"])
				}
			}

			else if (thing.type == "operation") {
				console.log("operation", thing)

				assemblyLoop(thing.left, false, true)
				assemblyLoop(thing.right, false, true)
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
				assemblyLoop(thing.left, false, true)
				assemblyLoop(thing.right, false, true)
				pushToAssembly(["equivalent"])
			}

			else if (thing.type == "if") {
				const jump_id = assembly.length

				assemblyLoop(thing.condition, false, true)
				pushToAssembly(["push", "*" + jump_id])
				pushToAssembly(["notConditionalJump"])
				assemblyLoop(thing.trueStatement, false, false)
				pushToAssembly(["@" + jump_id])
			}

			else if (thing.type == "if_else") {
				const trueJump_id = assembly.length
				const endJump_id = assembly.length + 1

				assemblyLoop(thing.condition, false, true)
				pushToAssembly(["push", "*" + trueJump_id])
				pushToAssembly(["conditionalJump"])

				assemblyLoop(thing.falseStatement, false, false)
				pushToAssembly(["push", "*" + endJump_id])
				pushToAssembly(["jump"])

				pushToAssembly(["@" + trueJump_id])
				assemblyLoop(thing.trueStatement, false, false)

				pushToAssembly(["@" + endJump_id])
			}

			else if (thing.type == "switch") {
				const endJump_id = "endJump_id" + assembly.length

				for (let index = 0; index < thing.statements.length; index++) {
					const Case = thing.statements[index];
					if (Case.lineNumber) lineNumber = Case.lineNumber
					
					if (Case.type != "case") err("not a case")

					const overJump_id = "overJump_id" + assembly.length

					assemblyLoop(Case.condition, false, true)

					pushToAssembly(["push", "*" + overJump_id])
					pushToAssembly(["notConditionalJump"])

					assemblyLoop(Case.statement, false, true)

					pushToAssembly(["push", "*" + endJump_id])
					pushToAssembly(["jump"])

					pushToAssembly(["@" + overJump_id])
				}

				pushToAssembly(["@" + endJump_id])
			}

			else if (thing.type ==  "case") {
				err("unexpected case")
			}
		}

		if (newScope) {
			if (level != 0) {
				pushToAssembly(["removeRegisters", String(getRegisterRequirement())])
			}

			delete variables[level]
			level--
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

	function pushToAssembly(data) {
		assembly.push(...data, "\n")
	}

	function getRegisterRequirement() {
		let count = 0
		for (const key in variables[level]) {
			if (variables[level][key].index > 0) {
				count++
			}
		}

		return count
	}

	function err(msg) {
		Modlite_compiler.handle_error(msg, lineNumber, level)
		throw "[getAssembly error]";
	}
}

Modlite_compiler.compileCode(rootPath)