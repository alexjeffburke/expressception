const proxyquire = require("proxyquire");

const Superagent = require("./Superagent");

let Test;
try {
  require("supertest");

  Test = proxyquire("supertest/lib/test", {
    superagent: require("./Superagent")
  });
} catch (e) {
  Test = null;
}

class Supertest {
  constructor(executeFn) {
    if (Test === null) {
      throw new Error("supertest is not installed");
    }
    this.agent = new Superagent(executeFn);
    this._flags = this.agent._flags;
  }

  _createTest(method, url) {
    this._flags.method = method;
    this._flags.path = url;
    const test = new Test("", "", "", "");
    test.agent = this.agent;
    test._flags = this._flags;
    return test;
  }

  del(url) {
    return this._createTest("delete", url);
  }

  get(url) {
    return this._createTest("get", url);
  }

  post(url) {
    return this._createTest("post", url);
  }

  put(url) {
    return this._createTest("put", url);
  }
}

module.exports = Supertest;
