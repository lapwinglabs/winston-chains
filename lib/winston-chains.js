var winston = require('winston')
  , inherits = require('util').inherits
  , format = require('util').format

var Logger = module.exports = function(tag, options, parent) {
  if (!(this instanceof Logger)) return new Logger(tag, options, parent);

  var self = this;
  this.tag = tag;
  this.attached = parent ? [parent] : [];
  this.logger = winston.loggers.add(this.tag, options);
  this.levels = this.logger.levels;
  this.setLevels(this.levels);

  function logger(childTag, childOptions) {
    return new Logger(childTag, childOptions, self);
  }
  for (var attr in Logger.prototype) {
    logger[attr] = Logger.prototype[attr];
  }
  logger.tag = this.tag;
  logger.attached = this.attached;
  logger.logger = this.logger;
  logger.levels = this.logger.levels;
  logger.object = this;
  logger.setLevels(logger.levels);

  // Forward events from logger
  var emit = this.logger.emit;
  this.logger.emit = function() {
    emit.apply(self.logger)
    logger.emit.apply(logger, arguments);
  }

  return logger;
}

inherits(Logger, winston.Logger);

Logger.transports = winston.transports;

// Attaches another log instance downstream
Logger.prototype.attach = function(logger) {
  this.attached.push(logger);
  if (isCircular(this)) {
    this.attached.pop();
    console.warn('Attaching logger %s to %s would create an infinite loop.', logger.tag, this.tag);
  }
  return this;
}

// Adds a transport for this logger to use.
Logger.prototype.use = Logger.prototype.add = function(transport, options) {
  this.logger.add(transport, options);
  return this;
}

Logger.prototype.remove = function(transport) {
  this.logger.remove(transport);
  return this;
} 

Logger.prototype.log = function(level, message, meta, callback) {
  this.logger.log.apply(this.logger, arguments);
  var args = Array.prototype.slice.call(arguments);
  this.attached.forEach(function(logger) {
    logger.log.apply(logger, args);
  });
}

Logger.prototype.setLevels = function(levels) {
  var self = this;
  Object.keys(levels).forEach(function (level) {
    self[level] = function (msg) {
      var args = [level].concat(Array.prototype.slice.call(arguments));
      self.log.apply(self, args);
    };
  });
  this.logger.setLevels(levels);
}

function isCircular(remaining, seen) {
  seen = seen || [];
  if (seen.indexOf(remaining) >= 0) return true;

  seen.push(remaining);
  remaining = remaining.attached || [];
  for (var i = 0; i < remaining.length; i++) {
    var node = remaining[i];
    var foundLoop = isCircular(node, seen);
  }
  seen.pop();
  return foundLoop;
}
