/*
	ModliteRunTime version 22

	For c.
 
	**has not been thoroughly tested for memory safety**
*/

#include <stdio.h>
#include "modlite.h"

void modlite_init(modlite_VMdata *data) {
	data->registers[9*4] = data->memorySize;
}

uint32_t modlite_pop(modlite_VMdata *data) {
	data->registers[9*4] += 4;
	return data->memory[data->registers[9*4]];
}

void modlite_run(modlite_VMdata *data, void (*exposedFunctions[])(void), int exposedFunctionsMaxID) {
	while (data->instructionPointer < data->memorySize) {
		uint8_t byte = data->memory[data->instructionPointer];
		
		uint8_t instruction = byte >> 2;
		
//		printf("instruction = %u\n", instruction);
		
		// jump
		if (instruction == 0) {
			uint32_t location = data->registers[0];
			
			// a jump to 0xFFFFFFFF ends the program
//			if (location == 4294967295) return;
			
			data->instructionPointer = location;
			continue;
		}
		
		// conditionalJump
		else if (instruction == 1) {
			uint32_t location = data->registers[0];
			uint8_t condition = data->registers[1*4] == 1;
			
			if (condition) {
				// a jump to 0xFFFFFFFF ends the program
//				if (location == 4294967295) return;
				
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
//				if (location == 4294967295) return;
				
				data->instructionPointer = location;
				continue;
			}
		}
		
		// externalJump
		else if (instruction == 3) {
			uint32_t ID =data->registers[0];
			
			if (ID > exposedFunctionsMaxID) {
				printf("externalJump: ID (%u) > exposedFunctionsMaxID", ID);
				return;
			}
			
			(*exposedFunctions[ID])();
		}
		
		// load
		else if (instruction == 4) {
			if (data->instructionPointer + 5 > data->memorySize) {
				printf("load: data->instructionPointer + 5 (%u) > data->memorySize (%u)", data->instructionPointer, data->memorySize);
				return;
			}
			
			data->instructionPointer += 1;
			uint32_t value = data->memory[data->instructionPointer];
			data->instructionPointer += 4;
			
			uint32_t registerToLoad = data->memory[data->instructionPointer];
			
			if (registerToLoad > maxRegister) {
				printf("load: registerToLoad (%u) > maxRegister (%u)", registerToLoad, maxRegister);
				return;
			}
			
			data->registers[registerToLoad] = value;
		}
		
		// staticTransfer
		else if (instruction == 5) {
			uint32_t value = 0;
			
			if ((byte & 0b00000010) != 0) {
				// from memory
				data->instructionPointer += 1;
				uint32_t location = data->memory[data->instructionPointer];
				data->instructionPointer += 3;
				
				if (location >= data->memorySize) {
					printf("staticTransfer: value location is >= memorySize");
					return;
				}
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
				
				if (location >= data->memorySize) {
					printf("staticTransfer: new location is >= memorySize");
					return;
				}

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
			data->instructionPointer += 1;
			uint8_t register1 = data->memory[data->instructionPointer]*4;
			uint32_t register1value = data->registers[register1];

			data->instructionPointer += 1;
			uint8_t register2 = data->memory[data->instructionPointer]*4;
			uint32_t register2value = data->registers[register2];
			
			data->registers[register1] = register1value == register2value;
		}
		
		// greaterThan
		else if (instruction == 12) {
			data->instructionPointer += 1;
			uint8_t register1 = data->memory[data->instructionPointer]*4;
			uint32_t register1value = data->registers[register1];

			data->instructionPointer += 1;
			uint8_t register2 = data->memory[data->instructionPointer]*4;
			uint32_t register2value = data->registers[register2];
			
			data->registers[register1] = register1value > register2value;
		}
		
		else {
			printf("unknown instruction");
			return;
		}
		
		data->instructionPointer += 1;
	}
}

// example usage
/*
#include <stdio.h>
#include <stdlib.h>
#include <sys/errno.h>
#include "modlite.h"

// returns 0 on success
// and errno or EFBIG on failure
int readFileToBuffer(const char *path, char *buffer, const size_t bufferSize) {
	FILE* file = fopen(path, "r");
	
	if (file == 0) {
		return errno;
	}

	// get the size of the file
	fseek(file, 0L, SEEK_END);
	size_t fileSize = ftell(file);
	rewind(file);
	
	if (fileSize > bufferSize) {
		return EFBIG;
	}

	fread(buffer, sizeof(char), fileSize, file);

	fclose(file);
	
	return 0;
}

modlite_VMdata VMdata = {0};

void print(void) {
	uint32_t index = modlite_pop(&VMdata);
	
	while (index < VMdata.memorySize) {
		uint8_t byte = VMdata.memory[index];
		if (byte == 0) {
			return;
		}
		
		putc(byte, stdout);
		
		index++;
	}
}

int main(int argc, char *argv[]) {
	if (argc != 4) {
		printf("argc != 4\n");
		return 1;
	}
	
	VMdata.memorySize = 2048;
	
	VMdata.memory = malloc(VMdata.memorySize);
	if (VMdata.memory == NULL) {
		printf("Insufficient memory available for VM memory (is your computer too small or is your memorySize too big?)\n");
		// free memory
		free(VMdata.memory);
		return 1;
	}
	
	VMdata.registers = malloc(9*4);
	if (VMdata.registers == NULL) {
		printf("Insufficient memory available for VM registers\n");
		
		// free memory
		free(VMdata.memory);
		free(VMdata.registers);
		return 1;
	}
	
	int returnValue = readFileToBuffer(argv[1], VMdata.memory, VMdata.memorySize);

	if (returnValue != 0) {
		if (returnValue == errno) {
			printf("file %s not found\n", argv[1]);
		} else if (returnValue == EFBIG) {
			printf("file at %s is to big\n", argv[1]);
		}
		// free memory
		free(VMdata.memory);
		free(VMdata.registers);
		return 1;
	}
	
	void (*exposedFunctions[])(void) = {&print};
	
	int exposedFunctionsMaxID = 0;
	
	modlite_init(&VMdata);
	
	modlite_run(&VMdata, exposedFunctions, exposedFunctionsMaxID);
	
	// free memory
	free(VMdata.memory);
	free(VMdata.registers);
	
	return 0;
}
*/
