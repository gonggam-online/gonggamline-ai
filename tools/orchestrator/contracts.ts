import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export class ContractValidationError extends Error {
  readonly errors: ErrorObject[];

  constructor(contractName: string, errors: ErrorObject[]) {
    super(`${contractName} failed canonical validation`);
    this.name = "ContractValidationError";
    this.errors = errors;
  }
}

export interface ContractValidators {
  validateTask(value: unknown): void;
  validateResult(value: unknown): void;
}

function compile(schema: object): ValidateFunction {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  return ajv.compile(schema);
}

function assertCanonical(
  contractName: string,
  validator: ValidateFunction,
  value: unknown,
): void {
  if (!validator(value)) {
    throw new ContractValidationError(contractName, validator.errors ?? []);
  }
}

export function createContractValidators(
  taskSchema: object,
  resultSchema: object,
): ContractValidators {
  const taskValidator = compile(taskSchema);
  const resultValidator = compile(resultSchema);

  return {
    validateTask(value: unknown): void {
      assertCanonical("TaskContract", taskValidator, value);
    },
    validateResult(value: unknown): void {
      assertCanonical("ResultContract", resultValidator, value);
    },
  };
}
