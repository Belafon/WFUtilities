// A test to examine string error throwing
import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import { fileSystem } from '../api/adapters/fileSystem';
import { passageManager } from '../api/services/passage.manager';
import * as ActualPaths from '../Paths';

suite('Error Handling Investigation', function() {
  test('should correctly handle string errors from unlink', async function() {
    // Setup stubs
    const unlinkSyncStub = sinon.stub(fileSystem, 'unlinkSync');
    const existsSyncStub = sinon.stub(fileSystem, 'existsSync');
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
      
      // Call the function
      await passageManager.deletePassage(passageId);
      
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
      assert.ok(
        showErrorNotificationStub.getCall(0).args[0].includes(stringError),
        'Error message should include the string error'
      );
    } finally {
      sinon.restore();
    }
  });
});
