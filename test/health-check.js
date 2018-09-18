/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

let assert = require('assert');
let extend = require('extend');
let nodeutil = require('util');
let proxyquire = require('proxyquire');
let ServiceObject = require('@google-cloud/common').ServiceObject;
let util = require('@google-cloud/common').util;

let promisified = false;
let fakeUtil = extend({}, util, {
  promisifyAll: function(Class) {
    if (Class.name === 'HealthCheck') {
      promisified = true;
    }
  },
});

function FakeServiceObject() {
  this.calledWith_ = arguments;
}

nodeutil.inherits(FakeServiceObject, ServiceObject);

describe('HealthCheck', function() {
  let HealthCheck;
  let healthCheck;

  let COMPUTE = {
    createHealthCheck: util.noop,
  };
  let HEALTH_CHECK_NAME = 'health-check-name';
  let OPTIONS = {};

  before(function() {
    HealthCheck = proxyquire('../src/health-check.js', {
      '@google-cloud/common': {
        ServiceObject: FakeServiceObject,
        util: fakeUtil,
      },
    });
  });

  beforeEach(function() {
    healthCheck = new HealthCheck(COMPUTE, HEALTH_CHECK_NAME, OPTIONS);
  });

  afterEach(function() {
    COMPUTE.createHealthCheck = util.noop;
  });

  describe('instantiation', function() {
    it('should inherit from ServiceObject', function() {
      assert(healthCheck instanceof FakeServiceObject);

      let calledWith = healthCheck.calledWith_[0];

      assert.strictEqual(calledWith.parent, COMPUTE);
      assert.strictEqual(calledWith.id, HEALTH_CHECK_NAME);
      assert.deepStrictEqual(calledWith.methods, {
        create: true,
        exists: true,
        get: true,
        getMetadata: true,
      });
    });

    it('should promisify all the things', function() {
      assert(promisified);
    });

    describe('http', function() {
      it('should set the correct baseUrl', function() {
        let calledWith = healthCheck.calledWith_[0];

        assert.strictEqual(calledWith.baseUrl, '/global/httpHealthChecks');
      });

      it('should not set options.https when created', function(done) {
        let createMethod = healthCheck.calledWith_[0].createMethod;

        let NAME = 'name';
        let OPTIONS = {a: 'b'};
        let originalOptions = extend({}, OPTIONS);

        COMPUTE.createHealthCheck = function(name, opts, callback) {
          assert.strictEqual(name, NAME);
          assert.deepStrictEqual(opts, OPTIONS);
          assert.deepStrictEqual(OPTIONS, originalOptions);
          callback(); // done()
        };

        createMethod(NAME, OPTIONS, done);
      });

      it('should not require a callback when creating', function(done) {
        let createMethod = healthCheck.calledWith_[0].createMethod;

        COMPUTE.createHealthCheck = function(name, opts, callback) {
          assert.deepStrictEqual(opts, {});
          callback(); // done()
        };

        createMethod('name', done);
      });
    });

    describe('https', function() {
      let healthCheck;

      beforeEach(function() {
        healthCheck = new HealthCheck(COMPUTE, HEALTH_CHECK_NAME, {
          https: true,
        });
      });

      it('should set the correct baseUrl', function() {
        let calledWith = healthCheck.calledWith_[0];

        assert.strictEqual(calledWith.baseUrl, '/global/httpsHealthChecks');
      });

      it('should set options.https = true when created', function(done) {
        let createMethod = healthCheck.calledWith_[0].createMethod;

        let NAME = 'name';
        let OPTIONS = {a: 'b'};
        let originalOptions = extend({}, OPTIONS);

        COMPUTE.createHealthCheck = function(name, opts, callback) {
          assert.strictEqual(name, NAME);
          assert.deepStrictEqual(opts, extend({https: true}, OPTIONS));
          assert.deepStrictEqual(OPTIONS, originalOptions);
          callback(); // done()
        };

        createMethod(NAME, OPTIONS, done);
      });

      it('should not require a callback when creating', function(done) {
        let createMethod = healthCheck.calledWith_[0].createMethod;

        COMPUTE.createHealthCheck = function(name, opts, callback) {
          assert.deepStrictEqual(opts, {https: true});
          callback(); // done()
        };

        createMethod('name', done);
      });
    });
  });

  describe('delete', function() {
    it('should call ServiceObject.delete', function(done) {
      FakeServiceObject.prototype.delete = function() {
        assert.strictEqual(this, healthCheck);
        done();
      };

      healthCheck.delete();
    });

    describe('error', function() {
      let error = new Error('Error.');
      let apiResponse = {a: 'b', c: 'd'};

      beforeEach(function() {
        FakeServiceObject.prototype.delete = function(callback) {
          callback(error, apiResponse);
        };
      });

      it('should return an error if the request fails', function(done) {
        healthCheck.delete(function(err, operation, apiResponse_) {
          assert.strictEqual(err, error);
          assert.strictEqual(operation, null);
          assert.strictEqual(apiResponse_, apiResponse);
          done();
        });
      });

      it('should not require a callback', function() {
        assert.doesNotThrow(function() {
          healthCheck.delete();
        });
      });
    });

    describe('success', function() {
      let apiResponse = {
        name: 'op-name',
      };

      beforeEach(function() {
        FakeServiceObject.prototype.delete = function(callback) {
          callback(null, apiResponse);
        };
      });

      it('should execute callback with Operation & Response', function(done) {
        let operation = {};

        healthCheck.compute.operation = function(name) {
          assert.strictEqual(name, apiResponse.name);
          return operation;
        };

        healthCheck.delete(function(err, operation_, apiResponse_) {
          assert.ifError(err);
          assert.strictEqual(operation_, operation);
          assert.strictEqual(operation_.metadata, apiResponse);
          assert.strictEqual(apiResponse_, apiResponse);
          done();
        });
      });

      it('should not require a callback', function() {
        assert.doesNotThrow(function() {
          healthCheck.delete();
        });
      });
    });
  });

  describe('setMetadata', function() {
    let METADATA = {};

    it('should call ServiceObject.setMetadata', function(done) {
      FakeServiceObject.prototype.setMetadata = function(metadata) {
        assert.strictEqual(this, healthCheck);
        assert.strictEqual(metadata, METADATA);
        done();
      };

      healthCheck.setMetadata(METADATA, assert.ifError);
    });

    describe('error', function() {
      let error = new Error('Error.');
      let apiResponse = {};

      beforeEach(function() {
        FakeServiceObject.prototype.setMetadata = function(metadata, callback) {
          callback(error, apiResponse);
        };
      });

      it('should return an error if the request fails', function(done) {
        healthCheck.setMetadata(METADATA, function(err, op, apiResponse_) {
          assert.strictEqual(err, error);
          assert.strictEqual(op, null);
          assert.strictEqual(apiResponse_, apiResponse);
          done();
        });
      });
    });

    describe('success', function() {
      let apiResponse = {
        name: 'op-name',
      };

      beforeEach(function() {
        FakeServiceObject.prototype.setMetadata = function(metadata, callback) {
          callback(null, apiResponse);
        };
      });

      it('should execute callback with operation & response', function(done) {
        let operation = {};
        let metadata = {a: 'b'};

        healthCheck.compute.operation = function(name) {
          assert.strictEqual(name, apiResponse.name);
          return operation;
        };

        healthCheck.setMetadata(metadata, function(err, op, apiResponse_) {
          assert.ifError(err);
          assert.strictEqual(op, operation);
          assert.strictEqual(op.metadata, apiResponse);
          assert.strictEqual(apiResponse_, apiResponse);
          done();
        });
      });

      it('should not require a callback', function() {
        assert.doesNotThrow(function() {
          healthCheck.setMetadata({a: 'b'});
        });
      });
    });
  });
});
