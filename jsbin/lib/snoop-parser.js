
var util = require('util');
var events = require('events');
var fs = require('fs');

var GLOBAL_HEADER_LENGTH = 16; //bytes
var PACKET_HEADER_LENGTH = 24; //bytes

function onError(err) {
  this.emit('error', err);
}

function onEnd() {
  this.emit('end');
}

function onData(data) {
  if (this.errored) {
    return;
  }

  updateBuffer.call(this, data);
  while (this.state.call(this)) {}
}

function updateBuffer(data) {
  if (data === null || data === undefined) {
    return;
  }

  if (this.buffer === null) {
    this.buffer = data;
  } else {
    var extendedBuffer = Buffer.alloc(this.buffer.length + data.length);
    this.buffer.copy(extendedBuffer);
    data.copy(extendedBuffer, this.buffer.length);
    this.buffer = extendedBuffer;
  }
}

function parseGlobalHeader() {
  var buffer = this.buffer;

  if (buffer.length >= GLOBAL_HEADER_LENGTH) {
    var msg;
    var magicNumber = buffer.toString('hex', 0, 8);

    // determine pcap endianness
    if (magicNumber == "736e6f6f70000000") {
      this.endianness = "BE";
    } else {
      this.errored = true;
      this.stream.pause();
      msg = util.format('not snoop file: %s', magicNumber);
      this.emit('error', new Error(msg));
      onEnd.call(this);
      return false;
    }

    var header = {
      magicNumber: 0,
      majorVersion: buffer['readUInt32' + this.endianness](8, true),
      minorVersion: 0,
/*       gmtOffset: buffer['readInt32' + this.endianness](8, true),
      timestampAccuracy: buffer['readUInt32' + this.endianness](12, true),
      snapshotLength: buffer['readUInt32' + this.endianness](16, true),
 */      
	   linkLayerType: buffer['readUInt32' + this.endianness](12, true)
    };

    if (header.majorVersion != 2 ) {
      this.errored = true;
      this.stream.pause();
      msg = util.format('unsupported version %d. snoop-parser only parses file format 2', header.majorVersion);
      this.emit('error', new Error(msg));
      onEnd.call(this);
    } else {
      this.emit('globalHeader', header);
      this.buffer = buffer.slice(GLOBAL_HEADER_LENGTH);
      this.state = parsePacketHeader;
      return true;
    }
  }

  return false;
}

function parsePacketHeader() {
  var buffer = this.buffer;

  if (buffer.length >= PACKET_HEADER_LENGTH) {
    var header = {
      originalLength: buffer['readUInt32' + this.endianness](0, true),
      // capturedLength: buffer['readUInt32' + this.endianness](4, true),
      packetLength: buffer['readUInt32' + this.endianness](8, true),
      capturedLength: buffer['readUInt32' + this.endianness](8, true) - PACKET_HEADER_LENGTH ,
      timestampSeconds: buffer['readUInt32' + this.endianness](16, true),
      timestampMicroseconds: buffer['readUInt32' + this.endianness](20, true)
    };

    this.currentPacketHeader = header;
    this.emit('packetHeader', header);
    this.buffer = buffer.slice(PACKET_HEADER_LENGTH);
    this.state = parsePacketBody;
    return true;
  }

  return false;
}

function parsePacketBody() {
  var buffer = this.buffer;

  if (buffer.length >= this.currentPacketHeader.capturedLength) {
    var data = buffer.slice(0, this.currentPacketHeader.capturedLength);

    this.emit('packetData', data);
    this.emit('packet', {
      header: this.currentPacketHeader,
      data: data
    });

    this.buffer = buffer.slice(this.currentPacketHeader.capturedLength);
    this.state = parsePacketHeader;
    return true;
  }

  return false;
}

function Parser(input) {
  if (typeof(input) == 'string') {
    this.stream = fs.createReadStream(input);
  } else {
    // assume a ReadableStream
    this.stream = input;
  }

  this.stream.pause();
  this.stream.on('data', onData.bind(this));
  this.stream.on('error', onError.bind(this));
  this.stream.on('end', onEnd.bind(this));

  this.buffer = null;
  this.state = parseGlobalHeader;
  this.endianness = null;

  process.nextTick(this.stream.resume.bind(this.stream));
}
util.inherits(Parser, events.EventEmitter);

exports.parse = function (input) {
  return new Parser(input);
};