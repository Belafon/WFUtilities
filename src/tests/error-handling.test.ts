
import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import { config } from '../WFServerConfig'; 
import { passageManager } from '../api/services/passage.manager';
import * as ActualPaths from '../Paths';

suite('Error Handling Investigation', function() {
  test('should correctly handle string errors from unlink', async function() {
    // Setup stubs
    const unlinkSyncStub = sinon.stub(config.fileSystem, 'unlinkSync');
    const existsSyncStub = sinon.stub(config.fileSystem, 'existsSync');
    // Important: Since passageManager is a singleton and already initialized,
    // we need to stub its internal editorAdapter directly
    const showErrorNotificationStub = sinon.stub(passageManager['editorAdapter'], 'showErrorNotification');
    const consoleErrorStub = sinon.stub(console, 'error');
    
    sinon.stub(ActualPaths, 'eventsDir').returns('./test_dir');
    
    const passageId = 'event1-char1-passage1'; // Valid ID format
    
    try {
      // Make existsSync return true so code reaches the unlink call
      existsSyncStub.returns(true);
      
      // Make unlinkSync throw a string error
      const stringError = "String error message";
      unlinkSyncStub.throws(stringError);
      
      // Call the function and expect it to throw
      await assert.rejects(
        async () => await passageManager.deletePassage(passageId),
        (error: Error) => error.message.includes('String error message')
      );
      
      // Print what was actually called
      console.log('Console.error was called?', consoleErrorStub.called);
      if (consoleErrorStub.called) {
        console.log('Console.error args:', consoleErrorStub.args[0]);
      }
      
      console.log('Error notification was called?', showErrorNotificationStub.called);
      if (showErrorNotificationStub.called) {
        console.log('Error notification args:', showErrorNotificationStub.args[0]);
      }
      
      // Check that error notification contains the expected message
      assert.ok(showErrorNotificationStub.called, 'Error notification should be called');
      
      // Expect the Sinon-prefixed error message
      const expectedErrorMessage = `Sinon-provided ${stringError}`;
      assert.ok(
        showErrorNotificationStub.getCall(0).args[0].includes(expectedErrorMessage),
        `Error message should include the string error with Sinon prefix.
        Expected to contain: "${expectedErrorMessage}"
        Got: "${showErrorNotificationStub.getCall(0).args[0]}"`
      );
    } finally {
      sinon.restore();
      // Reset the config to default values
      config.reset();
    }
  });
});