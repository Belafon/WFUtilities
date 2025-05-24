// A simple test to check if editor notifications work
import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import { passageManager } from '../api/services/passage.manager';

// Using TDD style since that's what the project is using
suite('PassageManager Notifications', function() {
  test('should show error notification for invalid passageId', async function() {
    // Setup stubs directly in the test
    const showErrorNotificationStub = sinon.stub(passageManager['editorAdapter'], 'showErrorNotification');
    
    try {
      const invalidPassageId = 'invalid-id';
      // Call the function and expect it to throw
      await assert.rejects(
        async () => await passageManager.deletePassage(invalidPassageId),
        (error: Error) => error.message.includes('Invalid passageId format')
      );
      
      assert.ok(showErrorNotificationStub.called, 'Error notification should be called');
      assert.ok(showErrorNotificationStub.getCall(0).args[0].includes('Invalid passageId format'), 
        'Error message should mention invalid format');
    } finally {
      // Clean up
      showErrorNotificationStub.restore();
    }
  });
});
