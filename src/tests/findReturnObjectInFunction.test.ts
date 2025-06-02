import * as assert from 'assert';
import {
  ParsedItemToken,
  SourcePointer,
  TokenGroup,
  TokenGrouper,
  Tokenizer,
  TokenStream,
  TypeScriptArrayBuilder,
  TypeScriptClassBuilder,
  TypeScriptCodeBuilder,
  TypeScriptInterfaceBuilder,
  TypeScriptTypeBuilder
} from '../typescriptObjectParser/ObjectParser'; // Adjust path as necessary
import { TypeScriptObjectBuilder } from "../typescriptObjectParser/TypeScriptObjectBuilder";

// Helper to create a TypeScriptCodeBuilder for findReturnObjectInFunction tests
async function createCodeBuilderForFunctionTest(functionDefinition: string): Promise<TypeScriptCodeBuilder> {
  const builder = new TypeScriptCodeBuilder(functionDefinition);
  // Allow parsing to complete
  await new Promise(resolve => setTimeout(resolve, 0));
  return builder;
}


suite('All suite tests', () => { 

  suite('TypeScriptCodeBuilder - findReturnObjectInFunction', () => {
    test('should find return object in a standard function declaration', async () => {
      const code = `
        function getStandardConfig() {
          return { version: 1, mode: "standard" };
        }
      `;
      const builder = await createCodeBuilderForFunctionTest(code);
      let found = false;
      builder.findReturnObjectInFunction('getStandardConfig', {
        onFound: (objectBuilder) => {
          found = true;
          assert.ok(objectBuilder instanceof TypeScriptObjectBuilder, 'Should return TypeScriptObjectBuilder');
          const content = objectBuilder.getContentText().trim();
          assert.ok(content.includes('version: 1'), 'Object content should include version');
          assert.ok(content.includes('mode: "standard"'), 'Object content should include mode');
        },
        onNotFound: () => {
          assert.fail('Should have found the return object in standard function');
        }
      });
      assert.ok(found, 'onFound callback was not called for standard function');
    });

    test('should find return object in a const arrow function returning an object directly', async () => {
      const code = `
        const getArrowConfigDirect = () => ({
          version: 2,
          mode: "arrow-direct"
        });
      `;
      const builder = await createCodeBuilderForFunctionTest(code);
      let found = false;
      builder.findReturnObjectInFunction('getArrowConfigDirect', {
        onFound: (objectBuilder) => {
          found = true;
          assert.ok(objectBuilder instanceof TypeScriptObjectBuilder, 'Should return TypeScriptObjectBuilder');
          const content = objectBuilder.getContentText().trim();
          // Note: For direct object return in arrow func `() => ({...})`, the outer parens are part of the
          // object literal's span in some parsers. Here we assume the builder correctly identifies the `{...}`.
          // If the parser includes the `(...)`, this test will fail and point to that.
          assert.ok(content.includes('version: 2'), 'Object content should include version');
          assert.ok(content.includes('mode: "arrow-direct"'), 'Object content should include mode');
        },
        onNotFound: () => {
          assert.fail('Should have found the return object in const arrow function (direct return)');
        }
      });
      assert.ok(found, 'onFound callback was not called for const arrow function (direct return)');
    });

    test('should find return object in a const arrow function with explicit return statement', async () => {
      const code = `
        const getArrowConfigExplicit = (s, e) => {
          void s; void e; // example of other statements
          return {
            version: 3,
            mode: "arrow-explicit"
          };
        };
      `;
      const builder = await createCodeBuilderForFunctionTest(code);
      let found = false;
      builder.findReturnObjectInFunction('getArrowConfigExplicit', {
        onFound: (objectBuilder) => {
          found = true;
          assert.ok(objectBuilder instanceof TypeScriptObjectBuilder, 'Should return TypeScriptObjectBuilder');
          const content = objectBuilder.getContentText().trim();
          assert.ok(content.includes('version: 3'), 'Object content should include version');
          assert.ok(content.includes('mode: "arrow-explicit"'), 'Object content should include mode');
        },
        onNotFound: () => {
          assert.fail('Should have found the return object in const arrow function (explicit return)');
        }
      });
      assert.ok(found, 'onFound callback was not called for const arrow function (explicit return)');
    });

    test('should find return object in a let arrow function with explicit return', async () => {
      const code = `
        let getLetArrowConfig = () => {
          return { version: 4, type: "let-arrow" };
        };
      `;
      const builder = await createCodeBuilderForFunctionTest(code);
      let found = false;
      builder.findReturnObjectInFunction('getLetArrowConfig', {
        onFound: (objectBuilder) => {
          found = true;
          const content = objectBuilder.getContentText().trim();
          assert.ok(content.includes('version: 4'));
        },
        onNotFound: () => assert.fail('Should find object in let arrow function')
      });
      assert.ok(found, 'onFound callback was not called for let arrow function');
    });

    test('should find return object in a var function expression', async () => {
      const code = `
        var getVarFuncExpr = function() {
          return { version: 5, type: "var-expr" };
        };
      `;
      const builder = await createCodeBuilderForFunctionTest(code);
      let found = false;
      builder.findReturnObjectInFunction('getVarFuncExpr', {
        onFound: (objectBuilder) => {
          found = true;
          const content = objectBuilder.getContentText().trim();
          assert.ok(content.includes('version: 5'));
        },
        onNotFound: () => assert.fail('Should find object in var function expression')
      });
      assert.ok(found, 'onFound callback was not called for var function expression');
    });
    
    test('should find return object in an async const arrow function', async () => {
      const code = `
        const getAsyncArrowData = async () => {
          // some async logic
          return { data: 'async_data', status: 200 };
        };
      `;
      const builder = await createCodeBuilderForFunctionTest(code);
      let found = false;
      builder.findReturnObjectInFunction('getAsyncArrowData', {
        onFound: (objectBuilder) => {
          found = true;
          const content = objectBuilder.getContentText().trim();
          assert.ok(content.includes("data: 'async_data'"));
          assert.ok(content.includes("status: 200"));
        },
        onNotFound: () => assert.fail('Should find object in async const arrow function')
      });
      assert.ok(found, 'onFound callback was not called for async const arrow function');
    });


    test('should call onNotFound if function does not return an object literal directly', async () => {
      const code = `
        function getString() {
          const obj = { message: "hello" };
          return obj.message; // Returns a string, not the object literal itself
        }
      `;
      const builder = await createCodeBuilderForFunctionTest(code);
      let notFound = false;
      builder.findReturnObjectInFunction('getString', {
        onFound: (objectBuilder) => {
          assert.fail('Should not have found an object literal for getString');
        },
        onNotFound: () => {
          notFound = true;
        }
      });
      assert.ok(notFound, 'onNotFound was not called for function not returning object literal');
    });

    test('should call onNotFound if function does not have a return statement', async () => {
      const code = `
        function noReturn() {
          console.log("side effect");
        }
      `;
      const builder = await createCodeBuilderForFunctionTest(code);
      let notFound = false;
      builder.findReturnObjectInFunction('noReturn', {
        onFound: (objectBuilder) => {
          assert.fail('Should not have found an object literal for noReturn');
        },
        onNotFound: () => {
          notFound = true;
        }
      });
      assert.ok(notFound, 'onNotFound was not called for function with no return');
    });

    test('should call onNotFound for a non-existent function', async () => {
      const code = `const x = 1;`;
      const builder = await createCodeBuilderForFunctionTest(code);
      let notFound = false;
      builder.findReturnObjectInFunction('nonExistentFunc', {
        onFound: (objectBuilder) => {
          assert.fail('Should not have found an object literal for nonExistentFunc');
        },
        onNotFound: () => {
          notFound = true;
        }
      });
      assert.ok(notFound, 'onNotFound was not called for non-existent function');
    });

    test('should handle multiple return statements (finds first object literal return)', async () => {
      const code = `
        function multipleReturns(condition: boolean) {
          if (condition) {
            return { type: "A", value: 1 };
          }
          // return "not an object"; // Could also test this branch
          return { type: "B", value: 2 };
        }
      `;
      const builder = await createCodeBuilderForFunctionTest(code);
      let found = false;
      builder.findReturnObjectInFunction('multipleReturns', {
        onFound: (objectBuilder) => { // Parser should ideally find the first one or be configurable
          found = true;
          const content = objectBuilder.getContentText().trim();
          assert.ok(content.includes('type: "A"'), 'Should find the first returned object content');
        },
        onNotFound: () => {
          assert.fail('Should have found a return object in multipleReturns');
        }
      });
      assert.ok(found, 'onFound callback was not called for multipleReturns');
    });

    test('should find return object in a function defined inside an object (method-like)', async () => {
      const code = `
        const myService = {
          getConfig: () => {
            return { version: 's1', mode: 'service' };
          },
          getData() { // Standard method syntax
            return { data: [1,2,3] };
          }
        };
      `;
      // Note: Current findReturnObjectInFunction likely won't support this directly as it searches top-level.
      // This test is to document the limitation or guide future enhancements.
      // To test this, one would first need to find `myService`, then somehow target `getConfig` within it.
      // For now, we'll test that it *doesn't* find it if called naively.

      const builder = await createCodeBuilderForFunctionTest(code);
      let notFoundArrow = false;
      builder.findReturnObjectInFunction('getConfig', { // This searches top-level 'getConfig'
        onFound: () => assert.fail('Should not find getConfig at top level'),
        onNotFound: () => { notFoundArrow = true; }
      });
      assert.ok(notFoundArrow, "getConfig (arrow method) should not be found at top-level.");

      let notFoundMethod = false;
      builder.findReturnObjectInFunction('getData', { // This searches top-level 'getData'
        onFound: () => assert.fail('Should not find getData at top level'),
        onNotFound: () => { notFoundMethod = true; }
      });
      assert.ok(notFoundMethod, "getData (method) should not be found at top-level.");
    });

  });

}); 