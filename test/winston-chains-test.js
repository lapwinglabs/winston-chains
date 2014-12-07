var winston = require('../lib/winston-chains');
var vows = require('vows');
var assert = require('assert');
var events = require('events');

// Setup one root log
var root1 = winston('root1', {
  console: { level: 'error' }
})

// Setup another root log
var root2 = winston('root2')
  .use(winston.transports.File, {
    level: 'error',
    filename: 'root2.log'
  })

// Setup a child log of root 1
var child = root1('child')
  .use(winston.transports.File, {
    level: 'debug',
    filename: 'child.log'
  })

function assertNoCircularChains() {
  assert.equal(child.attached.length, 1)
  // Attach child to root2 as well
  child.attach(root2);
  assert.equal(child.attached.length, 2)
  root2.attach(child);
  // Verify circular chain is not created
  assert.equal(root2.attached.length, 0)
}
assertNoCircularChains();

// Info messages logged to child should cascade to root2
vows.describe('Winston Chains').addBatch({
  'An info message logged to child': {
    topic: function() {
      var emitter = new events.EventEmitter;
      root2.once('logging', function(transport, level, msg, meta) {
        console.log('logged');
        emitter.emit('success', level, msg);
      })
      child.info('Child log info');
      return emitter;
    },
    'should propagate to root2': function (level, msg) {
      assert.equal(level, 'info');
      assert.equal(msg, 'Child log info');
    }
  }
})
// Info message logged to child should not cascade to root1
//   (root1 only setup to receive errors in console)
.addBatch({
  'Another info message logged to child': {
    topic: function() {
      var emitter = new events.EventEmitter;
      var timeoutErr = setTimeout(function () {
        root1.removeAllListeners();
        emitter.emit('success', null);
      }, 1000)
      root1.once('logging', function(transport, level, msg, meta) {
        clearTimeout(timeoutErr);
        emitter.emit('error', 'Message should not have been logged');
      })
      child.info('Child log info');
      return emitter;
    },
    'should not be logged by root1': function (err, level, msg) {
      assert.isNull(err);
    }
  }
})
//Error message logged to child should cascade to root1
.addBatch({
  'An error message logged to child': {
    topic: function() {
      var emitter = new events.EventEmitter;
      root1.once('logging', function(transport, level, msg, meta) {
        emitter.emit('success', level, msg);
      })
      child.error('Child log error');
      return emitter;
    },
    'should propagate to root2': function (level, msg) {
      assert.equal(level, 'error');
      assert.equal(msg, 'Child log error');
    }
  }
})
// Error message logged to child should cascade to root2
.addBatch({
  'An error message logged to child': {
    topic: function() {
      var emitter = new events.EventEmitter;
      root2.once('logging', function(transport, level, msg, meta) {
        emitter.emit('success', level, msg);
      })
      child.error('Child log error');
      return emitter;
    },
    'should propagate to root2': function (level, msg) {
      assert.equal(level, 'error');
      assert.equal(msg, 'Child log error');
    }
  }
})
// Error message logged to root2 or root1 should not cascade to child
.addBatch({
  'An error message logged to root2': {
    topic: function() {
      var emitter = new events.EventEmitter;
      var timeoutErr = setTimeout(function () {
        child.removeAllListeners();
        emitter.emit('success', null);
      }, 1000)
      child.once('logging', function(transport, level, msg, meta) {
        clearTimeout(timeoutErr);
        emitter.emit('error', 'Message should not have been logged');
      })
      root2.error('Child log info');
      root1.error('Child log info');
      return emitter;
    },
    'should not be logged by child': function (err, level, msg) {
      assert.isNull(err);
    }
  }
})
.run()