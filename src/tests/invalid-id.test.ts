// A test for invalid passageId format
import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import { passageManager } from '../api/services/passage.manager';

suite('Invalid PassageId Investigation', function() {
  test('should correctly report invalid passageId', async function() {
    // Setup stubs
    const showErrorNotificationStub = sinon.stub(passageManager['editorAdapter'], 'showErrorNotification');
    
    try {
      const invalidPassageId = 'invalid-id-format';
      
      // Call the function and expect it to throw
      await assert.rejects(
        async () => await passageManager.deletePassage(invalidPassageId),
        (error: Error) => error.message.includes('Invalid passageId format')
      );
      
      console.log('Error notification was called?', showErrorNotificationStub.called);
      console.log('Call count:', showErrorNotificationStub.callCount);
      
      if (showErrorNotificationStub.called) {
        console.log('Error notification exact message:', showErrorNotificationStub.args[0][0]);
      }
      
      assert.ok(showErrorNotificationStub.called, 'Error notification should be called');
    } finally {
      sinon.restore();
    }
  });
});
