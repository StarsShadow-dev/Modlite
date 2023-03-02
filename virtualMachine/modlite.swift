/*
	RunTime version 17 (unfinished)

	For Swift.
*/

import Foundation

// I do not know what I'm doing with Swift...
// and no one should take this as an example for writing good code in Swift

var binaryCodes:[String:String] = [
	"push": "a",
	"pop": "b",
	"addRegisters": "c",
	"removeRegisters": "d",
	"set": "e",
	"get": "f",
	"setGlobal": "g",
	"getGlobal": "h",
	"jump": "i",
	"conditionalJump": "j",
	"notConditionalJump": "k",
	"externalJump": "l",
	"createTable": "m",
	"removeTable": "n",
	"setTable": "o",
	"getTable": "p",
	"add": "q",
	"subtract": "r",
	"multiply": "s",
	"divide": "t",
	"equivalent": "u",
	"greaterThan": "v",
	"join": "w",
	"not": "x",
	"and": "y",
	"or": "z",
	"break": "\u{FFFF}",
]

// hack to make variables that are part of the _ModliteRunTime visible in the _ModliteRunTime
var ModliteRunTime:_ModliteRunTime = _ModliteRunTime()
class _ModliteRunTime {
	var exposedFunctions:[String:() -> Void] = [
		"MLSL:print":{
			print(ModliteRunTime.stack.popLast()!)
		},
		"MLSL:error":{
			print("[error] \(ModliteRunTime.stack.popLast()!) \n")
			print("index \(String(ModliteRunTime.index))")
			print("arp \(ModliteRunTime.arp)")
			print("stack \(ModliteRunTime.stack)")
			print("tables \(ModliteRunTime.tables)")
			print("program ending early\n")

			ModliteRunTime.reset()
		},
		"MLSL:startsWith":{
			var startString = ModliteRunTime.stack.popLast()
			var string = ModliteRunTime.stack.popLast()
			ModliteRunTime.stack.append(string!.hasPrefix(startString!) ? "1" : "0")
		},
		"MLSL:toNumber":{
			var string = ModliteRunTime.stack.popLast()
			ModliteRunTime.stack.append(String(Float32(string!)!))
		},
		"MLSL:asString":{
			// nothing needs to happen in swift
		},
		"MLSL:deleteTable":{
			var tableID = ModliteRunTime.stack.popLast()

			print("deleteTable \(String(describing: tableID!))")

			ModliteRunTime.tables[tableID!] = nil
		},
	]
	
	var tableCount:Int = 0
	var tables:[String: String] = [:]

	var index:UInt32 = 0
	var binary:String = ""
	var stack: [String] = []
	var arp:Int = 0 // activation record pointer
	
	func reset() {
		tableCount = 0
		tables = [:]

		index = 0
		binary = ""
		stack = []
		arp = 0
	}
	
	func run() throws {
		while (ModliteRunTime.index < ModliteRunTime.binary.count) {
			let char = getInString(string: ModliteRunTime.binary, index: Int(ModliteRunTime.index))
			
			// uncomment this to watch the stack change while running
//			print("\(ModliteRunTime.index) \(char)(\(charToBaseTen(char))) stack: \(ModliteRunTime.stack.description)")
			
			if (char == binaryCodes["push"]) {
				let data = goToBreak()
				ModliteRunTime.stack.append(data)
			}
			
			else if (char == binaryCodes["pop"]) {
				let amount = Int(goToBreak())!

				ModliteRunTime.stack.removeLast(amount)
			}
			
			else if (char == binaryCodes["addRegisters"]) {
				ModliteRunTime.stack.append(String(ModliteRunTime.arp))
				ModliteRunTime.arp = ModliteRunTime.stack.count-1
				let amount = Int(goToBreak())!
				
				if (amount > 0) {
					for _ in 1...amount {
						ModliteRunTime.stack.append("")
					}
				}
			}
			
			else if (char == binaryCodes["removeRegisters"]) {
				let amount = Int(goToBreak())!
				let newArp = Int(ModliteRunTime.stack.popLast()!)!
				
				ModliteRunTime.stack.removeLast(amount)
				ModliteRunTime.arp = newArp
			}
			
			else if (char == binaryCodes["set"]) {
				let int = goToBreak()
				let value = ModliteRunTime.stack.popLast()!
				
				ModliteRunTime.stack[Int(ModliteRunTime.arp)+Int(int)!] = value
			}
			
			else if (char == binaryCodes["get"]) {
				let int = goToBreak()
				
				ModliteRunTime.stack.append(ModliteRunTime.stack[Int(ModliteRunTime.arp)+Int(int)!])
			}

			else if (char == binaryCodes["setGlobal"]) {
				let int = goToBreak()
				let value = ModliteRunTime.stack.popLast()!
				
				ModliteRunTime.stack[Int(int)!] = value
			}
			
			else if (char == binaryCodes["getGlobal"]) {
				let int = goToBreak()
				
				ModliteRunTime.stack.append(ModliteRunTime.stack[Int(int)!])
			}
			
			else if (char == binaryCodes["jump"]) {
				let location = charToBaseTen(ModliteRunTime.stack.popLast()!)

				ModliteRunTime.index = location
				continue
			}
			
			else if (char == binaryCodes["conditionalJump"]) {
				let location = charToBaseTen(ModliteRunTime.stack.popLast()!)
				let condition = ModliteRunTime.stack.popLast()!
				
				if (condition == "1") {
					ModliteRunTime.index = location
					continue
				}
			}

			else if (char == binaryCodes["notConditionalJump"]) {
				let location = charToBaseTen(ModliteRunTime.stack.popLast()!)
				let condition = ModliteRunTime.stack.popLast()!
				
				if (condition == "0") {
					ModliteRunTime.index = location
					continue
				}
			}

			else if (char == binaryCodes["externalJump"]) {
				let name = ModliteRunTime.stack.popLast()!
				
				ModliteRunTime.exposedFunctions[name]!()
			}
			
//			else if (char == binaryCodes["createTable"]) {
//				// console.log("createTable", this.tableCount)
//
//				this.tables[this.tableCount] = {}
//				this.stack.push(String(this.tableCount++))
//			}
//
//			else if (char == binaryCodes["removeTable"]) {
//				let tableID = this.stack.pop()
//
//				// console.log("removeTable", tableID)
//
//				delete this.tables[tableID]
//			}
//
//			else if (char == binaryCodes["setTable"]) {
//				let value = this.stack.pop()
//				let ID = this.stack.pop()
//				let tableID = this.stack.pop()
//
//				// console.log("setTable", tableID, ID, value, this.tables)
//
//				this.tables[tableID][ID] = value
//			}
//
//			else if (char == binaryCodes["getTable"]) {
//				let ID = this.stack.pop()
//				let tableID = this.stack.pop()
//
//				// console.log("getTable", tableID, ID, this.tables)
//
//				this.stack.push(this.tables[tableID][ID])
//			}
//
//			else if (char == binaryCodes["add"]) {
//				let number2 = this.stack.pop()
//				let number1 = this.stack.pop()
//
//				// console.log("add", number1, number2)
//
//				this.stack.push(String(Number(number1) + Number(number2)))
//			}
//
//			else if (char == binaryCodes["subtract"]) {
//				let number2 = this.stack.pop()
//				let number1 = this.stack.pop()
//
//				// console.log("subtract", number1, number2)
//
//				this.stack.push(String(Number(number1) - Number(number2)))
//			}
//
//			else if (char == binaryCodes["multiply"]) {
//				let number2 = this.stack.pop()
//				let number1 = this.stack.pop()
//
//				// console.log("multiply", number1, number2)
//
//				this.stack.push(String(Number(number1) * Number(number2)))
//			}
//
//			else if (char == binaryCodes["divide"]) {
//				let number2 = this.stack.pop()
//				let number1 = this.stack.pop()
//
//				// console.log("divide", number1, number2)
//
//				this.stack.push(String(Number(number1) / Number(number2)))
//			}
//
//			else if (char == binaryCodes["equivalent"]) {
//				let value2 = this.stack.pop()
//				let value1 = this.stack.pop()
//
//				// console.log("equivalent", value1, value2)
//
//				this.stack.push(value1 == value2 ? "1" : "0")
//			}
//
//			else if (char == binaryCodes["greaterThan"]) {
//				let value2 = this.stack.pop()
//				let value1 = this.stack.pop()
//
//				// console.log("greaterThan", value1, value2, Number(value1) > Number(value2))
//
//				this.stack.push(Number(value1) > Number(value2) ? "1" : "0")
//			}
//
//			else if (char == binaryCodes["join"]) {
//				let string2 = this.stack.pop()
//				let string1 = this.stack.pop()
//
//				// console.log("join", string1, string2)
//
//				this.stack.push(string1 + string2)
//			}
//
//			else if (char == binaryCodes["not"]) {
//				let bool = this.stack.pop()
//
//				this.stack.push(bool == "0" ? "1" : "0")
//			}
//
//			else if (char == binaryCodes["and"]) {
//				let value2 = this.stack.pop()
//				let value1 = this.stack.pop()
//
//				// console.log("and", value1, value2)
//
//				this.stack.push(value1 == "1" && value2 == "1")
//			}
//
//			else if (char == binaryCodes["or"]) {
//				let value2 = this.stack.pop()
//				let value1 = this.stack.pop()
//
//				// console.log("or", value1, value2)
//
//				this.stack.push(value1 == "1" || value2 == "1")
//			}
//
			else {
				fatalError("unexpected character: '\(char)'(\(charToBaseTen(char)) at \(ModliteRunTime.index)")
			}
			
			ModliteRunTime.index += 1
		}
	}
}

func charToBaseTen(_ string:String) -> UInt32 {
	return UInt32(string.utf8.first!)
}

func goToBreak() -> String {
	var past:String = ""
	while (true) {
		ModliteRunTime.index += 1
		
		if (ModliteRunTime.index > ModliteRunTime.binary.count) {
			return past
		}
		
		let char = getInString(string: ModliteRunTime.binary, index: Int(ModliteRunTime.index))

		if (char.description == binaryCodes["break"]) {
			return past
		} else {
			past = past + String(char)
		}
	}
}

// this looks bad, but it works
func getInString(string:String, index:Int) -> String {
	return String(string[string.index(string.startIndex, offsetBy: index)])
}
