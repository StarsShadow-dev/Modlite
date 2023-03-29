/*
	ModliteRunTime version 22

	For c.
*/

#include <stdio.h>
#include "modlite.h"

void modlite_init(modlite_VMdata *data) {
	printf("modlite_init\n");
	
	data->registers[9*4] = data->memorySize;
}

void modlite_run(modlite_VMdata *data, void (*exposedFunctions[])(void)) {
	printf("modlite_run\n");
	
	while (data->instructionPointer < data->memorySize) {
		uint8_t byte = data->memory[data->instructionPointer];
		
		uint8_t instruction = byte >> 2;
		
		printf("instruction = %u\n", instruction);
		
		// jump
		if (instruction == 0) {
			uint32_t location = data->registers[0];
			
			// a jump to 0xFFFFFFFF ends the program
			if (location == 4294967295) return;
			
			data->instructionPointer = location;
			continue;
		}
		
		// conditionalJump
		else if (instruction == 1) {
			uint32_t location = data->registers[0];
			uint8_t condition = data->registers[1*4] == 1;
			
			if (condition) {
				// a jump to 0xFFFFFFFF ends the program
				if (location == 4294967295) return;
				
				data->instructionPointer = location;
				continue;
			}
		}
		
		// notConditionalJump
		else if (instruction == 2) {
			uint32_t location = data->registers[0];
			uint8_t condition = data->registers[1*4] == 1;
			
			if (!condition) {
				// a jump to 0xFFFFFFFF ends the program
				if (location == 4294967295) return;
				
				data->instructionPointer = location;
				continue;
			}
		}
		
		// externalJump
		else if (instruction == 3) {
			uint32_t ID = data->registers[0];
			
			(*exposedFunctions[ID])();
		}
		
		// load
		else if (instruction == 4) {
			data->instructionPointer += 1;
			uint32_t value = data->memory[data->instructionPointer];
			data->instructionPointer += 4;
			
			uint32_t R = data->memory[data->instructionPointer];
			
			data->registers[R] = value;
		}
		
		// staticTransfer
		else if (instruction == 5) {
			uint32_t value = 0;
			
			if ((byte & 0b00000010) != 0) {
				// from memory
				data->instructionPointer += 1;
				uint32_t location = data->memory[data->instructionPointer];
				data->instructionPointer += 3;
//
				value = data->memory[location];
			} else {
				// from register
				data->instructionPointer += 1;
				uint8_t R = data->memory[data->instructionPointer]*4;

				value = data->registers[R];
			}
			
			printf("staticTransfer %u\n", value);
			
			if ((byte & 0b00000001) != 0) {
				// to memory
				uint32_t location = data->memory[1*4];

				data->memory[location] = value;
			} else {
				// to register
				data->instructionPointer += 1;
				uint8_t R = data->memory[data->instructionPointer]*4;
				
				data->registers[R] = value;
			}
		}
		
		// dynamicTransfer
		else if (instruction == 6) {
			uint32_t value = 0;

			data->instructionPointer += 1;
			uint8_t register1 = data->memory[data->instructionPointer]*4;

			// get value
			if ((byte & 0b00000010) != 0) {
				// from memory specified by the register
//				const location = this.registers.getUint32(register1)
				uint32_t location = data->registers[register1];

				value = data->memory[location];
			} else {
				// from register
				value = data->registers[register1];
			}

			data->instructionPointer += 1;
			uint8_t register2 = data->memory[data->instructionPointer]*4;

			// set value
			if ((byte & 0b00000001) != 0) {
				// to memory specified by the register
				uint32_t location = data->registers[register2];

				// console.log("dynamicTransfer location", location)

				data->registers[location] = value;
			} else {
				// to register
				data->registers[register2] = value;
			}
		}
		
		// add
		else if (instruction == 7) {
			data->instructionPointer += 1;
			uint8_t register1 = data->memory[data->instructionPointer]*4;
			uint32_t register1value = data->registers[register1];

			data->instructionPointer += 1;
			uint8_t register2 = data->memory[data->instructionPointer]*4;
			uint32_t register2value = data->registers[register2];
			
			data->registers[register1] = register1value + register2value;
		}
		
		// subtract
		else if (instruction == 8) {
			data->instructionPointer += 1;
			uint8_t register1 = data->memory[data->instructionPointer]*4;
			uint32_t register1value = data->registers[register1];

			data->instructionPointer += 1;
			uint8_t register2 = data->memory[data->instructionPointer]*4;
			uint32_t register2value = data->registers[register2];
			
			data->registers[register1] = register1value - register2value;
		}
		
		// multiply
		else if (instruction == 9) {
			data->instructionPointer += 1;
			uint8_t register1 = data->memory[data->instructionPointer]*4;
			uint32_t register1value = data->registers[register1];

			data->instructionPointer += 1;
			uint8_t register2 = data->memory[data->instructionPointer]*4;
			uint32_t register2value = data->registers[register2];
			
			data->registers[register1] = register1value * register2value;
		}
		
		// divide
		else if (instruction == 10) {
			data->instructionPointer += 1;
			uint8_t register1 = data->memory[data->instructionPointer]*4;
			uint32_t register1value = data->registers[register1];

			data->instructionPointer += 1;
			uint8_t register2 = data->memory[data->instructionPointer]*4;
			uint32_t register2value = data->registers[register2];
			
			data->registers[register1] = register1value / register2value;
		}
		
		// equivalent
		else if (instruction == 11) {
			printf("no equivalent");
			return;
		}
		
		// greaterThan
		else if (instruction == 12) {
			printf("no greaterThan");
			return;
		}
		
		else {
			printf("unknown instruction");
			return;
		}
		
		data->instructionPointer += 1;
	}
}
